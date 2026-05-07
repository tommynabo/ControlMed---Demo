-- ============================================================================
-- FIX: Liquidación faltante — Benita Abad Garcia
-- Dra. Abigail Concejero — 20/04/2026 — 60€ — Tartrectomia
-- ============================================================================
-- Contexto:
--   La cita está en estado REALIZADA y COBRADA en ControlMed pero no aparece
--   en la liquidación de Dra. Concejero para Abril 2026.
--   Causa probable: el pago se procesó sin enviar doctorId → doctor = null
--   en el backend → condición `if (doctor && ...)` impidió crear Liquidation.
--
-- INSTRUCCIONES:
--   1. Ejecutar primero diagnose_liquidaciones_benita_youssef.sql para
--      confirmar el estado actual.
--   2. Ejecutar PASO 1 (SELECT). Si devuelve 0 filas → ejecutar PASO 2a.
--      Si devuelve 1 fila con doctorId incorrecto → descomentar PASO 2b.
--   3. Verificar con PASO 3.
--
-- ⚠️  Ejecutar en Supabase → SQL Editor
-- ============================================================================


-- ─── PASO 1: Verificar que no existe Liquidation para la cita ────────────────
-- Resultado esperado antes del fix: 0 filas.
SELECT
    l.id,
    l."doctorId",
    d.name     AS doctor_nombre,
    l."grossAmount",
    l."finalAmount",
    l."createdAt"
FROM "Liquidation" l
LEFT JOIN "Doctor" d ON d.id = l."doctorId"
WHERE l."appointmentId" IN (
    SELECT a.id
    FROM "Appointment" a
    JOIN "Patient" p ON p.id = a."patientId"
    WHERE p.name ILIKE '%benita%abad%'
      AND a.date::date = '2026-04-20'
      AND a."deleted_at" IS NULL
);


-- ─── PASO 2a: INSERT Liquidation (ejecutar si PASO 1 devuelve 0 filas) ───────
-- Usa los datos de la cita y el doctor asignado en la tabla Appointment.
-- createdAt se fija a la fecha de la cita (12:00) para que quede en Abril 2026.
INSERT INTO "Liquidation" (
    id,
    "doctorId",
    "appointmentId",
    "grossAmount",
    "baseAmount",
    "labCost",
    "commissionRate",
    "finalAmount",
    "treatmentName",
    "patientName",
    "paymentMethod",
    status,
    "createdAt"
)
SELECT
    gen_random_uuid()::text                                          AS id,
    a."doctorId"                                                     AS "doctorId",
    a.id                                                             AS "appointmentId",
    COALESCE(a.amount::numeric, 60)                                  AS "grossAmount",
    COALESCE(a.amount::numeric, 60)                                  AS "baseAmount",
    0                                                                AS "labCost",
    COALESCE(NULLIF(doc."commissionPercentage"::numeric, 0), 30)     AS "commissionRate",
    COALESCE(a.amount::numeric, 60)
        * COALESCE(NULLIF(doc."commissionPercentage"::numeric, 0), 30)
        / 100                                                        AS "finalAmount",
    COALESCE(
        NULLIF(TRIM(a."treatmentName"), ''),
        'Tartrectomia'
    )                                                                AS "treatmentName",
    p.name                                                           AS "patientName",
    COALESCE(inv."paymentMethod", 'cash')                            AS "paymentMethod",
    'PENDING'                                                        AS status,
    (a.date::timestamp + INTERVAL '12 hours')                        AS "createdAt"
FROM "Appointment" a
JOIN  "Patient" p    ON p.id   = a."patientId"
LEFT JOIN "Doctor" doc   ON doc.id = a."doctorId"
LEFT JOIN "Invoice" inv  ON inv."appointmentId" = a.id
WHERE p.name ILIKE '%benita%abad%'
  AND a.date::date = '2026-04-20'
  AND a."deleted_at" IS NULL
  -- Guardia: no insertar si ya existe
  AND NOT EXISTS (
      SELECT 1 FROM "Liquidation" l WHERE l."appointmentId" = a.id
  );


-- ─── PASO 2b: UPDATE doctorId si ya existe con doctor incorrecto ─────────────
-- (Descomentar solo si PASO 1 devolvió 1 fila con doctorId distinto al de Dra. Concejero)
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
--       AND a.date::date = '2026-04-20'
--       AND a."deleted_at" IS NULL
-- );


-- ─── PASO 3: Verificación final ──────────────────────────────────────────────
-- Resultado esperado: 1 fila con doctor = Dra. Concejero/Abigail,
-- grossAmount = 60, finalAmount = 18 (30% de 60).
SELECT
    l.id,
    l."doctorId",
    d.name             AS doctor_nombre,
    l."grossAmount",
    l."commissionRate",
    l."finalAmount",
    l."treatmentName",
    l."patientName",
    l."paymentMethod",
    l."createdAt"      AS liq_fecha_proceso,
    a.date             AS cita_fecha
FROM "Liquidation" l
JOIN  "Doctor" d ON d.id = l."doctorId"
LEFT JOIN "Appointment" a ON a.id = l."appointmentId"
WHERE l."appointmentId" IN (
    SELECT a2.id
    FROM "Appointment" a2
    JOIN "Patient" p ON p.id = a2."patientId"
    WHERE p.name ILIKE '%benita%abad%'
      AND a2."deleted_at" IS NULL
);
