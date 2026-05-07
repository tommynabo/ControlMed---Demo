-- ============================================================================
-- FIX: Liquidación faltante — Paqui Saez Sanchez
-- Dr. Pablo ROO — 21/04/2026 — 595€ — Corona S/Implante 36 y 46
-- ============================================================================
-- Contexto:
--   Cita en estado REALIZADA y COBRADA. No aparece en la liquidación de Pablo.
--   Causa probable: pago procesado sin doctorId → doctor = null en backend
--   → condición `if (doctor && ...)` impidió crear el registro Liquidation.
--
--   Nota sobre la fecha: la cita aparece como 21/04 en el sistema aunque el
--   pago se cobró el 22/04. El INSERT usa la fecha de la cita (21/04) para que
--   la liquidación quede correctamente en Abril 2026.
--
-- INSTRUCCIONES:
--   1. Ejecutar PASO 1. Si devuelve 0 filas → ejecutar PASO 2.
--      Si devuelve 1 fila con doctorId incorrecto → descomentar PASO 2b.
--   2. Verificar con PASO 3.
--
-- ⚠️  Ejecutar en Supabase → SQL Editor
-- ============================================================================


-- ─── PASO 1: Verificar que no existe Liquidation para la cita ────────────────
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
    WHERE p.name ILIKE '%paqui%saez%'
      AND a.date::date = '2026-04-21'
      AND a."deleted_at" IS NULL
);


-- ─── PASO 2a: INSERT Liquidation (ejecutar si PASO 1 devuelve 0 filas) ───────
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
    gen_random_uuid()::text                                           AS id,
    a."doctorId"                                                      AS "doctorId",
    a.id                                                              AS "appointmentId",
    COALESCE(a.amount::numeric, 595)                                  AS "grossAmount",
    COALESCE(a.amount::numeric, 595)                                  AS "baseAmount",
    0                                                                 AS "labCost",
    COALESCE(NULLIF(doc."commissionPercentage"::numeric, 0), 30)      AS "commissionRate",
    COALESCE(a.amount::numeric, 595)
        * COALESCE(NULLIF(doc."commissionPercentage"::numeric, 0), 30)
        / 100                                                         AS "finalAmount",
    COALESCE(
        NULLIF(TRIM(a."treatmentName"), ''),
        'Corona S/Implante 36 y 46'
    )                                                                 AS "treatmentName",
    p.name                                                            AS "patientName",
    COALESCE(inv."paymentMethod", 'cash')                             AS "paymentMethod",
    'PENDING'                                                         AS status,
    (a.date::timestamp + INTERVAL '9 hours 30 minutes')               AS "createdAt"
FROM "Appointment" a
JOIN  "Patient" p    ON p.id   = a."patientId"
LEFT JOIN "Doctor" doc   ON doc.id = a."doctorId"
LEFT JOIN "Invoice" inv  ON inv."appointmentId" = a.id
WHERE p.name ILIKE '%paqui%saez%'
  AND a.date::date = '2026-04-21'
  AND a."deleted_at" IS NULL
  AND NOT EXISTS (
      SELECT 1 FROM "Liquidation" l WHERE l."appointmentId" = a.id
  );


-- ─── PASO 2b: UPDATE doctorId si ya existe con doctor incorrecto ─────────────
-- (Descomentar solo si PASO 1 devolvió 1 fila con doctorId distinto al de Dr. Pablo Roo)
--
-- UPDATE "Liquidation"
-- SET "doctorId" = (
--     SELECT id FROM "Doctor" WHERE name ILIKE '%pablo%roo%' LIMIT 1
-- )
-- WHERE "appointmentId" IN (
--     SELECT a.id
--     FROM "Appointment" a
--     JOIN "Patient" p ON p.id = a."patientId"
--     WHERE p.name ILIKE '%paqui%saez%'
--       AND a.date::date = '2026-04-21'
--       AND a."deleted_at" IS NULL
-- );


-- ─── PASO 3: Verificación final ──────────────────────────────────────────────
-- Resultado esperado: doctor = Dr. Pablo Roo, grossAmount = 595,
-- finalAmount = 178.50 (30% de 595).
SELECT
    l.id,
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
    WHERE p.name ILIKE '%paqui%saez%'
      AND a2."deleted_at" IS NULL
);
