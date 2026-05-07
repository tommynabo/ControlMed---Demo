-- ============================================================================
-- DIAGNÓSTICO: Liquidaciones faltantes — Benita Abad Garcia & Youssef el Kabouri
-- ============================================================================
-- Propósito:
--   Verificar el estado actual de las citas, pagos, facturas y liquidaciones
--   de estos dos pacientes antes de ejecutar los scripts de corrección.
--
-- ⚠️  Solo lectura — ejecutar en Supabase → SQL Editor (no modifica nada).
-- ============================================================================

-- ─── 1. IDs de los doctores relevantes ───────────────────────────────────────
-- Confirma los UUIDs antes de ejecutar los fixes.
SELECT
    id,
    name,
    "commissionPercentage"
FROM "Doctor"
WHERE name ILIKE '%concejero%'
   OR name ILIKE '%abigail%'
   OR name ILIKE '%pablo%roo%'
   OR name ILIKE '%chrabieh%'
ORDER BY name;


-- ─── 2. Benita Abad Garcia — cita, factura y liquidación ─────────────────────
SELECT
    a.id              AS appointment_id,
    a.date            AS cita_fecha,
    a.status          AS cita_estado,
    a.paid            AS cita_pagada,
    a.amount          AS cita_importe,
    d.name            AS cita_doctor,
    -- Factura
    inv."invoiceNumber",
    inv.amount        AS inv_importe,
    inv."paymentMethod",
    inv.date          AS inv_fecha,
    -- Liquidación
    l.id              AS liquidation_id,
    l."doctorId"      AS liq_doctor_id,
    ld.name           AS liq_doctor_nombre,
    l."grossAmount"   AS liq_bruto,
    l."finalAmount"   AS liq_comision,
    l."createdAt"     AS liq_fecha_proceso
FROM "Appointment" a
JOIN  "Patient" p    ON p.id   = a."patientId"
LEFT JOIN "Doctor"  d    ON d.id   = a."doctorId"
LEFT JOIN "Invoice" inv  ON inv."appointmentId" = a.id
LEFT JOIN "Liquidation" l ON l."appointmentId" = a.id
LEFT JOIN "Doctor"  ld   ON ld.id  = l."doctorId"
WHERE p.name ILIKE '%benita%abad%'
  AND a."deleted_at" IS NULL
ORDER BY a.date DESC;


-- ─── 3. Youssef el Kabouri — cita, pago, factura y liquidación ───────────────
SELECT
    a.id              AS appointment_id,
    a.date            AS cita_fecha,
    a.status          AS cita_estado,
    a.amount          AS cita_importe,
    d.name            AS cita_doctor,
    -- Pago
    pay.id            AS payment_id,
    pay.amount        AS pay_importe,
    pay."doctorId"    AS pay_doctor_id,
    pd.name           AS pay_doctor_nombre,
    pay.method        AS pay_metodo,
    -- Factura
    inv."invoiceNumber",
    inv.amount        AS inv_importe,
    inv."paymentMethod",
    inv.date          AS inv_fecha,
    -- Liquidación
    l.id              AS liquidation_id,
    l."doctorId"      AS liq_doctor_id,
    ld.name           AS liq_doctor_nombre,
    l."grossAmount"   AS liq_bruto,
    l."finalAmount"   AS liq_comision,
    l."createdAt"     AS liq_fecha_proceso
FROM "Appointment" a
JOIN  "Patient" p    ON p.id   = a."patientId"
LEFT JOIN "Doctor"  d    ON d.id   = a."doctorId"
LEFT JOIN "Payment" pay  ON pay."appointmentId" = a.id
LEFT JOIN "Doctor"  pd   ON pd.id  = pay."doctorId"
LEFT JOIN "Invoice" inv  ON inv."appointmentId" = a.id
LEFT JOIN "Liquidation" l ON l."appointmentId" = a.id
LEFT JOIN "Doctor"  ld   ON ld.id  = l."doctorId"
WHERE p.name ILIKE '%youssef%'
  AND a."deleted_at" IS NULL
ORDER BY a.date DESC;


-- ─── 4. Resumen liquidaciones de Dra. Concejero (Abigail) en Abril 2026 ──────
-- Confirma qué pacientes SÍ aparecen y cuáles faltan.
SELECT
    l."patientName",
    l."treatmentName",
    l."grossAmount",
    l."finalAmount",
    l."createdAt",
    a.date AS cita_fecha
FROM "Liquidation" l
LEFT JOIN "Appointment" a ON a.id = l."appointmentId"
WHERE l."doctorId" IN (
    SELECT id FROM "Doctor" WHERE name ILIKE '%concejero%' OR name ILIKE '%abigail%'
)
  AND (
      l."createdAt" >= '2026-04-01'::timestamp
      AND l."createdAt" <  '2026-05-01'::timestamp
  )
ORDER BY l."createdAt";


-- ─── 5. Resumen liquidaciones de Dr. Pablo Roo en Abril 2026 ─────────────────
SELECT
    l."patientName",
    l."treatmentName",
    l."grossAmount",
    l."finalAmount",
    l."createdAt",
    a.date AS cita_fecha
FROM "Liquidation" l
LEFT JOIN "Appointment" a ON a.id = l."appointmentId"
WHERE l."doctorId" IN (
    SELECT id FROM "Doctor" WHERE name ILIKE '%pablo%roo%'
)
  AND (
      l."createdAt" >= '2026-04-01'::timestamp
      AND l."createdAt" <  '2026-05-01'::timestamp
  )
ORDER BY l."createdAt";
