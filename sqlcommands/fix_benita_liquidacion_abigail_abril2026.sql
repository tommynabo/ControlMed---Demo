-- ============================================================================
-- DIAGNÓSTICO + FIX: Liquidación faltante — Benita Abad Garcia
-- Dra. Abigail Concejero — Abril 2026
-- ============================================================================
-- Problema: Benita aparece en la captura de facturación/caja como cobrada
--   y asignada a Dra. Concejero, pero NO aparece en su liquidación de Abril.
-- Causa más probable: el pago se procesó sin doctorId resuelto → la condición
--   `if (doctor && ...)` en finance.js impidió crear la fila Liquidation.
--
-- INSTRUCCIONES:
--   1. Ejecutar PASO 1 — localizar la cita y ver si tiene Liquidation.
--   2. Si la columna liquidation_id es NULL → ejecutar PASO 2a (INSERT).
--   3. Si ya existe pero con doctorId incorrecto → descomentar PASO 2b (UPDATE).
--   4. Verificar con PASO 3.
-- ⚠️  Ejecutar en Supabase → SQL Editor
-- ============================================================================


-- ─── PASO 1: Diagnóstico — citas de Benita Abad en Abril 2026 ────────────────
-- Resultado esperado: al menos 1 fila con liquidation_id = NULL
SELECT
    a.id              AS appointment_id,
    a.date            AS cita_fecha,
    a.status          AS cita_estado,
    a.paid            AS cita_pagada,
    a.amount          AS cita_importe,
    a."treatmentName" AS tratamiento,
    d.name            AS cita_doctor,
    -- Factura / pago
    inv."invoiceNumber",
    inv.amount        AS inv_importe,
    inv."paymentMethod",
    pay.id            AS payment_id,
    pay.amount        AS pay_importe,
    -- Liquidación
    l.id              AS liquidation_id,
    ld.name           AS liq_doctor_nombre,
    l."grossAmount"   AS liq_bruto,
    l."finalAmount"   AS liq_comision
FROM "Appointment" a
JOIN  "Patient" p    ON p.id    = a."patientId"
LEFT JOIN "Doctor"  d    ON d.id    = a."doctorId"
LEFT JOIN "Invoice" inv  ON inv."appointmentId" = a.id
LEFT JOIN "Payment" pay  ON pay."appointmentId" = a.id
LEFT JOIN "Liquidation" l  ON l."appointmentId"  = a.id
LEFT JOIN "Doctor"  ld   ON ld.id   = l."doctorId"
WHERE p.name ILIKE '%benita%abad%'
  AND a.date >= '2026-04-01'
  AND a.date <  '2026-05-01'
  AND a."deleted_at" IS NULL
ORDER BY a.date;


-- ─── PASO 1b: Si el resultado de arriba está vacío, buscar en todo Abril ──────
-- (en caso de que la cita tenga una fecha ligeramente fuera del rango)
SELECT
    a.id              AS appointment_id,
    a.date            AS cita_fecha,
    a.status,
    a.paid,
    a.amount          AS cita_importe,
    a."treatmentName",
    d.name            AS doctor,
    l.id              AS liquidation_id
FROM "Appointment" a
JOIN  "Patient" p ON p.id = a."patientId"
LEFT JOIN "Doctor" d ON d.id = a."doctorId"
LEFT JOIN "Liquidation" l ON l."appointmentId" = a.id
WHERE p.name ILIKE '%benita%abad%'
  AND a."deleted_at" IS NULL
ORDER BY a.date DESC
LIMIT 10;


-- ─── PASO 2a: INSERT Liquidation faltante (si PASO 1 devuelve liquidation_id NULL) ─
-- Crea la fila para TODAS las citas de Benita en Abril 2026 que no tienen Liquidation.
-- La guarda idempotente (AND NOT EXISTS).
INSERT INTO "Liquidation" (
    id,
    "doctorId",
    "appointmentId",
    "grossAmount",
    "baseAmount",
    "labCost",
    "commissionRate",
    "finalAmount",
    "referralCommission",
    "treatmentName",
    "patientName",
    "paymentMethod",
    status,
    "createdAt"
)
SELECT
    gen_random_uuid()::text                                           AS id,
    a."doctorId"                                                      AS "doctorId",
    a.id                                                              AS "appointmentId",
    a.amount::numeric                                                 AS "grossAmount",
    a.amount::numeric                                                 AS "baseAmount",
    0                                                                 AS "labCost",
    COALESCE(NULLIF(doc."commissionPercentage"::numeric, 0), 30)      AS "commissionRate",
    a.amount::numeric
        * COALESCE(NULLIF(doc."commissionPercentage"::numeric, 0), 30)
        / 100                                                         AS "finalAmount",
    0                                                                 AS "referralCommission",
    COALESCE(NULLIF(TRIM(a."treatmentName"), ''),
             inv.concept,
             'Tratamiento')                                           AS "treatmentName",
    p.name                                                            AS "patientName",
    COALESCE(inv."paymentMethod", pay.method, 'cash')                 AS "paymentMethod",
    'PENDING'                                                         AS status,
    -- createdAt = fecha de la cita a mediodía para que quede en Abril 2026
    (a.date::timestamp + INTERVAL '12 hours')                         AS "createdAt"
FROM "Appointment" a
JOIN  "Patient" p    ON p.id    = a."patientId"
JOIN  "Doctor"  doc  ON doc.id  = a."doctorId"
LEFT JOIN "Invoice" inv  ON inv."appointmentId" = a.id
LEFT JOIN "Payment" pay  ON pay."appointmentId" = a.id
WHERE p.name ILIKE '%benita%abad%'
  AND a.date >= '2026-04-01'
  AND a.date <  '2026-05-01'
  AND a.paid = true
  AND a."deleted_at" IS NULL
  AND a.amount > 0
  -- Guardia: no duplicar si ya existe
  AND NOT EXISTS (
      SELECT 1 FROM "Liquidation" l WHERE l."appointmentId" = a.id
  );
-- Resultado esperado: "INSERT 0 1" (o tantas filas como citas tenga en Abril)


-- ─── PASO 2b: Si ya existe Liquidation con doctor incorrecto → reasignar ─────
-- (Descomentar solo si PASO 1 mostró liquidation_id con doctor diferente a Abigail)
--
-- UPDATE "Liquidation"
-- SET "doctorId" = (
--     SELECT id FROM "Doctor"
--     WHERE name ILIKE '%concejero%' OR name ILIKE '%abigail%'
--     LIMIT 1
-- )
-- WHERE "appointmentId" IN (
--     SELECT a.id
--     FROM "Appointment" a
--     JOIN "Patient" p ON p.id = a."patientId"
--     WHERE p.name ILIKE '%benita%abad%'
--       AND a.date >= '2026-04-01'
--       AND a.date <  '2026-05-01'
--       AND a."deleted_at" IS NULL
-- );


-- ─── PASO 3: Verificación final ──────────────────────────────────────────────
-- Resultado esperado: fila con doctor = Dra. Concejero/Abigail,
-- grossAmount = importe de la cita, finalAmount = grossAmount × 30%.
SELECT
    l.id                AS liquidation_id,
    d.name              AS doctor,
    l."patientName",
    l."treatmentName",
    l."grossAmount",
    l."commissionRate"  AS tasa_comision,
    l."finalAmount",
    l."paymentMethod",
    l."createdAt"       AS liq_fecha,
    a.date              AS cita_fecha
FROM "Liquidation" l
JOIN  "Doctor" d ON d.id = l."doctorId"
LEFT JOIN "Appointment" a ON a.id = l."appointmentId"
WHERE l."patientName" ILIKE '%benita%abad%'
  AND COALESCE(a.date, l."createdAt"::date) >= '2026-04-01'
  AND COALESCE(a.date, l."createdAt"::date) <  '2026-05-01'
ORDER BY a.date;


-- ─── PASO 4: Confirmar totales de Abigail en Abril 2026 ──────────────────────
SELECT
    COUNT(*)                  AS num_registros,
    SUM(l."grossAmount")      AS total_bruto,
    SUM(l."finalAmount")      AS total_a_pagar_dr
FROM "Liquidation" l
JOIN  "Doctor" d ON d.id = l."doctorId"
LEFT JOIN "Appointment" a ON a.id = l."appointmentId"
WHERE (d.name ILIKE '%concejero%' OR d.name ILIKE '%abigail%')
  AND COALESCE(a.date, l."createdAt"::date) >= '2026-04-01'
  AND COALESCE(a.date, l."createdAt"::date) <  '2026-05-01';
