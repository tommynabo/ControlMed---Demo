-- ============================================================================
-- DIAGNÓSTICO + FIX: Liquidaciones faltantes de Dr. Kevin Chrabieh — Abril 2026
-- Caso conocido: Sandra (y cualquier otra cita pagada sin Liquidation)
-- ============================================================================
-- INSTRUCCIONES:
--   1. Ejecutar SECCIÓN A para ver todas las citas pagadas de Kevin sin Liquidation.
--   2. Revisar el resultado e identificar cuáles faltan (ej. Sandra).
--   3. Ejecutar SECCIÓN B para crear las Liquidations faltantes de una vez.
--   4. Verificar con SECCIÓN C.
-- ============================================================================


-- ─── SECCIÓN A: Diagnóstico — citas pagadas de Kevin SIN Liquidation ─────────
SELECT
    a.id              AS appointment_id,
    a.date            AS cita_fecha,
    a.amount          AS importe,
    p.name            AS paciente,
    d.name            AS doctor,
    inv."invoiceNumber",
    inv."paymentMethod",
    inv.amount        AS inv_importe
FROM "Appointment" a
JOIN  "Patient" p   ON p.id   = a."patientId"
JOIN  "Doctor"  d   ON d.id   = a."doctorId"
LEFT JOIN "Invoice" inv ON inv."appointmentId" = a.id
WHERE d.name ILIKE '%chrabieh%'
  AND a.date >= '2026-04-01'
  AND a.date <  '2026-05-01'
  AND a.paid = true
  AND a."deleted_at" IS NULL
  AND a.amount > 0
  AND NOT EXISTS (
      SELECT 1 FROM "Liquidation" l WHERE l."appointmentId" = a.id
  )
ORDER BY a.date;


-- ─── SECCIÓN B: INSERT masivo de Liquidations faltantes (Dr. Kevin, Abril) ───
-- Crea Liquidation para TODAS las citas de Kevin en Abril 2026 que:
--   • están pagadas (paid = true)
--   • tienen amount > 0
--   • NO tienen todavía un registro Liquidation
-- El commissionPercentage de Kevin puede ser 0 en DB, usamos 30% como fallback
-- (igual que el resto de doctores). Ajústalo si su comisión es diferente.
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
    a.amount::numeric                                                 AS "grossAmount",
    a.amount::numeric                                                 AS "baseAmount",
    0                                                                 AS "labCost",
    COALESCE(NULLIF(doc."commissionPercentage"::numeric, 0), 30)      AS "commissionRate",
    a.amount::numeric
        * COALESCE(NULLIF(doc."commissionPercentage"::numeric, 0), 30)
        / 100                                                         AS "finalAmount",
    COALESCE(NULLIF(TRIM(a."treatmentName"), ''), inv.concept, 'Tratamiento') AS "treatmentName",
    p.name                                                            AS "patientName",
    COALESCE(inv."paymentMethod", 'cash')                             AS "paymentMethod",
    'PENDING'                                                         AS status,
    -- createdAt = fecha de la cita al mediodía (para que caiga en el mes correcto)
    (a.date::timestamp + INTERVAL '12 hours')                         AS "createdAt"
FROM "Appointment" a
JOIN  "Patient" p   ON p.id   = a."patientId"
JOIN  "Doctor"  doc ON doc.id = a."doctorId"
LEFT JOIN "Invoice" inv ON inv."appointmentId" = a.id
WHERE doc.name ILIKE '%chrabieh%'
  AND a.date >= '2026-04-01'
  AND a.date <  '2026-05-01'
  AND a.paid = true
  AND a."deleted_at" IS NULL
  AND a.amount > 0
  AND NOT EXISTS (
      SELECT 1 FROM "Liquidation" l WHERE l."appointmentId" = a.id
  );


-- ─── SECCIÓN C: Verificación final — liquidaciones de Kevin en Abril 2026 ─────
SELECT
    l."patientName",
    l."treatmentName",
    l."grossAmount",
    l."finalAmount",
    l."createdAt"     AS liq_fecha,
    a.date            AS cita_fecha,
    d.name            AS doctor
FROM "Liquidation" l
JOIN  "Doctor" d ON d.id = l."doctorId"
LEFT JOIN "Appointment" a ON a.id = l."appointmentId"
WHERE d.name ILIKE '%chrabieh%'
  AND COALESCE(a.date, l."createdAt"::date) >= '2026-04-01'
  AND COALESCE(a.date, l."createdAt"::date) <  '2026-05-01'
ORDER BY COALESCE(a.date, l."createdAt"::date);
