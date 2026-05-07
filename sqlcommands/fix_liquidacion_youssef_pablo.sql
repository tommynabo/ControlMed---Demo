-- ============================================================================
-- FIX: Reasignar Liquidation y Payment de Youssef el Kabouri
-- De Dr. Kevin Chrabieh → Dr. Pablo Roo Blanco — 23/04/2026 — 60€
-- ============================================================================
-- Contexto:
--   El script create_youssef_extraccion_invoice.js creó el Payment, Invoice y
--   Liquidation con doctorId de Dr. Kevin Chrabieh (user-1).
--   La cita pertenece a Dr. Pablo Roo Blanco (user-3).
--   Por eso Youssef aparece en la caja con el doctor correcto en la Appointment
--   pero la Liquidation (y el Payment) apuntan al doctor equivocado.
--
-- INSTRUCCIONES:
--   1. Ejecutar PASO 1 (SELECT) para confirmar el estado actual.
--   2. Si PASO 1 muestra liq_doctor = Chrabieh → ejecutar PASO 2 y PASO 3.
--   3. Verificar con PASO 4.
--
-- ⚠️  Ejecutar en Supabase → SQL Editor
-- ============================================================================


-- ─── PASO 1: Verificar estado actual ─────────────────────────────────────────
-- Resultado esperado: liq_doctor_nombre = Dr. Kevin Chrabieh, pay_doctor_nombre = idem.
SELECT
    a.id              AS appointment_id,
    a.date            AS cita_fecha,
    a.amount          AS cita_importe,
    d.name            AS cita_doctor,
    -- Liquidación
    l.id              AS liquidation_id,
    l."doctorId"      AS liq_doctor_id,
    ld.name           AS liq_doctor_nombre,
    l."grossAmount",
    l."finalAmount",
    l."createdAt"     AS liq_fecha_proceso,
    -- Pago
    pay.id            AS payment_id,
    pay."doctorId"    AS pay_doctor_id,
    pd.name           AS pay_doctor_nombre,
    pay.amount        AS pay_importe,
    pay.method        AS pay_metodo,
    -- Factura
    inv."invoiceNumber",
    inv.amount        AS inv_importe
FROM "Appointment" a
JOIN  "Patient" p    ON p.id   = a."patientId"
LEFT JOIN "Doctor"  d    ON d.id   = a."doctorId"
LEFT JOIN "Liquidation" l ON l."appointmentId" = a.id
LEFT JOIN "Doctor"  ld   ON ld.id  = l."doctorId"
LEFT JOIN "Payment" pay  ON pay."appointmentId" = a.id
LEFT JOIN "Doctor"  pd   ON pd.id  = pay."doctorId"
LEFT JOIN "Invoice" inv  ON inv."appointmentId" = a.id
WHERE p.name ILIKE '%youssef%'
  AND a.date::date = '2026-04-23'
  AND a."deleted_at" IS NULL;


-- ─── PASO 2: Corregir Liquidation.doctorId → Dr. Pablo Roo ───────────────────
UPDATE "Liquidation"
SET "doctorId" = (
    SELECT id FROM "Doctor"
    WHERE name ILIKE '%pablo%roo%'
    LIMIT 1
)
WHERE "appointmentId" IN (
    SELECT a.id
    FROM "Appointment" a
    JOIN "Patient" p ON p.id = a."patientId"
    WHERE p.name ILIKE '%youssef%'
      AND a.date::date = '2026-04-23'
      AND a."deleted_at" IS NULL
);


-- ─── PASO 3: Corregir Payment.doctorId → Dr. Pablo Roo (consistencia) ────────
UPDATE "Payment"
SET "doctorId" = (
    SELECT id FROM "Doctor"
    WHERE name ILIKE '%pablo%roo%'
    LIMIT 1
)
WHERE "appointmentId" IN (
    SELECT a.id
    FROM "Appointment" a
    JOIN "Patient" p ON p.id = a."patientId"
    WHERE p.name ILIKE '%youssef%'
      AND a.date::date = '2026-04-23'
      AND a."deleted_at" IS NULL
);


-- ─── PASO 4: Verificación final ──────────────────────────────────────────────
-- Resultado esperado: liq_doctor_nombre y pay_doctor_nombre = Dr. Pablo Roo Blanco,
-- grossAmount = 60, finalAmount = 18 (30% de 60).
SELECT
    l.id,
    l."doctorId",
    ld.name            AS liq_doctor_nombre,
    l."grossAmount",
    l."commissionRate",
    l."finalAmount",
    l."treatmentName",
    l."patientName",
    l."createdAt"      AS liq_fecha_proceso,
    pay."doctorId"     AS pay_doctor_id,
    pd.name            AS pay_doctor_nombre
FROM "Liquidation" l
JOIN  "Doctor" ld ON ld.id = l."doctorId"
LEFT JOIN "Payment" pay ON pay."appointmentId" = l."appointmentId"
LEFT JOIN "Doctor"  pd  ON pd.id = pay."doctorId"
WHERE l."appointmentId" IN (
    SELECT a.id
    FROM "Appointment" a
    JOIN "Patient" p ON p.id = a."patientId"
    WHERE p.name ILIKE '%youssef%'
      AND a."deleted_at" IS NULL
);
