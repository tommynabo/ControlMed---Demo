-- ============================================================================
-- DIAGNÓSTICO: Liquidaciones faltantes — Paqui Saez, ODA Dairo & Tomas Meco
-- Dr. Pablo ROO — Abril 2026
-- ============================================================================
-- ⚠️  Solo lectura — ejecutar en Supabase → SQL Editor (no modifica nada).
-- ============================================================================


-- ─── 1. Paqui Saez Sanchez — cita, factura y liquidación ─────────────────────
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
WHERE p.name ILIKE '%paqui%saez%'
  AND a."deleted_at" IS NULL
ORDER BY a.date DESC;


-- ─── 2. ODA Dairo Ramirez Gil — cita, factura y liquidación ──────────────────
SELECT
    a.id              AS appointment_id,
    a.date            AS cita_fecha,
    a.status          AS cita_estado,
    a.paid            AS cita_pagada,
    a.amount          AS cita_importe,
    d.name            AS cita_doctor,
    p."isODA"         AS paciente_es_oda,
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
WHERE (p.name ILIKE '%dairo%' OR p.name ILIKE '%ramirez%gil%')
  AND a."deleted_at" IS NULL
ORDER BY a.date DESC;


-- ─── 3. Tomas Meco Durban — verificar fecha real vs. fecha en sistema ─────────
-- El sistema muestra 22/4/2026 pero la visita fue el 20/4/2026.
SELECT
    a.id              AS appointment_id,
    a.date            AS cita_fecha_sistema,
    a.status,
    a.paid,
    a.amount,
    d.name            AS doctor,
    l.id              AS liquidation_id,
    l."createdAt"     AS liq_fecha_proceso,
    l."grossAmount",
    inv."invoiceNumber",
    inv.date          AS inv_fecha
FROM "Appointment" a
JOIN  "Patient" p    ON p.id   = a."patientId"
LEFT JOIN "Doctor"  d    ON d.id   = a."doctorId"
LEFT JOIN "Liquidation" l ON l."appointmentId" = a.id
LEFT JOIN "Invoice"  inv ON inv."appointmentId" = a.id
WHERE p.name ILIKE '%tomas%meco%'
  AND a."deleted_at" IS NULL
ORDER BY a.date DESC;


-- ─── 4. Altaf Ahmed — todas las liquidaciones de abril (verificar duplicados) ─
-- Las entradas del 27/4 (80€ + 60€) aparecen resaltadas como posibles errores.
-- Revisar si son de la misma cita o de dos citas distintas.
SELECT
    l.id              AS liquidation_id,
    l."patientName",
    l."treatmentName",
    l."grossAmount",
    l."finalAmount",
    l."createdAt"     AS liq_fecha_proceso,
    a.date            AS cita_fecha,
    a.id              AS appointment_id,
    inv."invoiceNumber"
FROM "Liquidation" l
LEFT JOIN "Appointment" a ON a.id = l."appointmentId"
LEFT JOIN "Invoice" inv   ON inv."appointmentId" = a.id
WHERE l."patientName" ILIKE '%altaf%'
  AND l."createdAt" >= '2026-04-01'
  AND l."createdAt" <  '2026-05-01'
ORDER BY l."createdAt";

-- También contar citas de Altaf Ahmed en abril para cruzar con liquidaciones:
SELECT
    a.id,
    a.date,
    a.status,
    a.amount,
    a.paid,
    d.name AS doctor
FROM "Appointment" a
JOIN  "Patient" p ON p.id = a."patientId"
LEFT JOIN "Doctor" d ON d.id = a."doctorId"
WHERE p.name ILIKE '%altaf%'
  AND a.date >= '2026-04-01'
  AND a.date <  '2026-05-01'
  AND a."deleted_at" IS NULL
ORDER BY a.date;


-- ─── 5. Resumen completo Dr. Pablo ROO — todas las liquidaciones de abril ─────
-- Confirma cuáles existen y cuáles faltan.
SELECT
    l."patientName",
    l."treatmentName",
    l."grossAmount",
    l."finalAmount",
    l."createdAt"     AS liq_fecha_proceso,
    a.date            AS cita_fecha
FROM "Liquidation" l
LEFT JOIN "Appointment" a ON a.id = l."appointmentId"
WHERE l."doctorId" IN (
    SELECT id FROM "Doctor" WHERE name ILIKE '%pablo%roo%'
)
  AND (
      -- Filtrar por fecha de cita si existe, si no por createdAt
      COALESCE(a.date, l."createdAt"::date) >= '2026-04-01'
      AND COALESCE(a.date, l."createdAt"::date) < '2026-05-01'
  )
ORDER BY COALESCE(a.date, l."createdAt"::date);
