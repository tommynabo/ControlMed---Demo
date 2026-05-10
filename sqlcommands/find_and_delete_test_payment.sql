-- ═══════════════════════════════════════════════════════════════════════════
-- PASO 1 — AUDITAR PAGOS ANÓMALOS (todos los tipos)
-- ═══════════════════════════════════════════════════════════════════════════

-- 1a. Resumen por tipo — ver dónde está el importe inflado
SELECT
    type,
    COUNT(*)         AS num_pagos,
    SUM(amount)      AS total_importe,
    MAX(amount)      AS maximo
FROM "Payment"
GROUP BY type
ORDER BY total_importe DESC;

-- 1b. Pagos de cualquier tipo con importe elevado (>= 1.000 €)
SELECT
    id,
    "patientId",
    amount,
    method,
    type,
    notes,
    "createdAt"
FROM "Payment"
WHERE amount >= 1000
ORDER BY amount DESC;

-- ═══════════════════════════════════════════════════════════════════════════
-- PASO 2 — LOCALIZAR SALDOS HUÉRFANOS
-- Paciente eliminado pero su Payment de cartera quedó en la tabla
-- ═══════════════════════════════════════════════════════════════════════════

-- 2a. Payments sin paciente vinculado (patientId = NULL o paciente borrado)
SELECT
    p.id,
    p."patientId",
    p.amount,
    p.type,
    p.method,
    p.notes,
    p."createdAt"
FROM "Payment" p
LEFT JOIN "Patient" pat ON pat.id = p."patientId"
WHERE pat.id IS NULL
ORDER BY p.amount DESC;

-- 2b. Saldo de cartera de pacientes que ya no existen
--     (si tienes columna walletBalance en Patient, esto también lo refleja)
SELECT
    p.id          AS payment_id,
    p."patientId",
    p.amount,
    p.type,
    p.notes,
    p."createdAt"
FROM "Payment" p
LEFT JOIN "Patient" pat ON pat.id = p."patientId"
WHERE pat.id IS NULL
  AND p.type IN ('WALLET_TOPUP', 'ADVANCE_PAYMENT', 'ADVANCE')
ORDER BY p.amount DESC;

-- ═══════════════════════════════════════════════════════════════════════════
-- PASO 3 — ELIMINAR EL PAGO HUÉRFANO
-- Sustituye '<ID_DEL_PAGO>' con el ID del resultado del paso 2b.
-- ═══════════════════════════════════════════════════════════════════════════

-- 3a. Confirmar antes de borrar
-- SELECT * FROM "Payment" WHERE id = '<ID_DEL_PAGO>';

-- 3b. Eliminar factura vinculada si existe
-- DELETE FROM "Invoice" WHERE "relatedPaymentId" = '<ID_DEL_PAGO>';

-- 3c. Eliminar el pago
-- DELETE FROM "Payment" WHERE id = '<ID_DEL_PAGO>';

-- ═══════════════════════════════════════════════════════════════════════════
-- PASO 4 — VERIFICACIÓN FINAL
-- ═══════════════════════════════════════════════════════════════════════════

-- Ingresos reales (solo cobros clínicos, sin recargas de cartera)
SELECT
    SUM(amount) AS ingresos_clinicos,
    COUNT(*)    AS num_registros
FROM "Payment"
WHERE type = 'DIRECT_CHARGE'
  AND amount > 0;

-- Total global por tipo (para confirmar que no queda nada anómalo)
SELECT
    type,
    COUNT(*) AS num_pagos,
    SUM(amount) AS total
FROM "Payment"
GROUP BY type
ORDER BY total DESC;
