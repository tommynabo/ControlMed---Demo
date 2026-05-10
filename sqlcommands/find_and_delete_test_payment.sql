-- ═══════════════════════════════════════════════════════════════════════════
-- PASO 1 — AUDITAR PAGOS ANÓMALOS
-- Ejecutar primero para localizar el pago de prueba de ~150.000 €
-- ═══════════════════════════════════════════════════════════════════════════

-- 1a. Ver todos los pagos con importe superior a 10.000 €
SELECT
    id,
    "patientId",
    amount,
    method,
    type,
    notes,
    "createdAt"
FROM "Payment"
WHERE amount > 10000
ORDER BY amount DESC;


-- 1b. Auditar el total histórico desglosado por tipo de pago
SELECT
    type,
    COUNT(*)         AS num_pagos,
    SUM(amount)      AS total_importe,
    MIN(amount)      AS minimo,
    MAX(amount)      AS maximo,
    MIN("createdAt") AS primer_pago,
    MAX("createdAt") AS ultimo_pago
FROM "Payment"
GROUP BY type
ORDER BY total_importe DESC;


-- 1c. Total histórico global
SELECT
    COUNT(*)    AS total_registros,
    SUM(amount) AS total_historico
FROM "Payment";


-- ═══════════════════════════════════════════════════════════════════════════
-- PASO 2 — ELIMINAR EL PAGO DE PRUEBA
-- Sustituye '<ID_DEL_PAGO>' con el ID real obtenido en el paso 1a.
-- IMPORTANTE: ejecutar primero el SELECT para confirmar antes de borrar.
-- ═══════════════════════════════════════════════════════════════════════════

-- 2a. Verificar el pago concreto antes de borrar
-- SELECT * FROM "Payment" WHERE id = '<ID_DEL_PAGO>';

-- 2b. Eliminar también su factura vinculada (si existe)
-- DELETE FROM "Invoice" WHERE "relatedPaymentId" = '<ID_DEL_PAGO>';

-- 2c. Eliminar el pago
-- DELETE FROM "Payment" WHERE id = '<ID_DEL_PAGO>';


-- ═══════════════════════════════════════════════════════════════════════════
-- PASO 3 — AUDITAR INGRESOS REALES (solo tipo DIRECT_CHARGE, sin recargas)
-- Esto mostrará lo que la analítica mostrará DESPUÉS del fix del backend.
-- ═══════════════════════════════════════════════════════════════════════════

SELECT
    DATE_TRUNC('month', "createdAt") AS mes,
    COUNT(*)                          AS num_cobros,
    SUM(amount)                       AS ingresos_reales
FROM "Payment"
WHERE type = 'DIRECT_CHARGE'
  AND amount > 0
GROUP BY mes
ORDER BY mes DESC;


-- ═══════════════════════════════════════════════════════════════════════════
-- PASO 4 — VERIFICACIÓN FINAL
-- Tras eliminar el pago de prueba, confirmar que el total es coherente.
-- ═══════════════════════════════════════════════════════════════════════════

SELECT
    SUM(amount) AS nuevo_total_historico,
    COUNT(*)    AS num_registros
FROM "Payment"
WHERE type = 'DIRECT_CHARGE'
  AND amount > 0;
