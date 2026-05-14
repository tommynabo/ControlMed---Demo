-- ============================================================================
-- DIAGNÓSTICO: Pacientes faltantes en liquidación Dra. Abigail — Abril 2026
-- ============================================================================
-- Propósito: verificar el estado de las 4 citas que faltan antes de corregir.
--
-- ⚠️  Solo lectura — ejecutar en Supabase → SQL Editor (no modifica nada).
--
-- Pacientes a buscar:
--   20/04 — Enrique Martínez    — Tartrectomia     — 60 €
--   20/04 — Ma José Moreno      — Tartrectomia     — 60 €
--   21/04 — Eduardo Dimas       — Obturación simple pieza 2.1 — 60 €
--   21/04 — Paulo De Castro     — Obturación clase II D17     — 80 €
-- ============================================================================


-- ─── 1. ID y comisión de la Dra. Abigail ─────────────────────────────────────
-- Anota el id que devuelva esta consulta; lo necesitarás en el script de fix.
SELECT
    id,
    name,
    "commissionPercentage"
FROM "Doctor"
WHERE name ILIKE '%abigail%'
ORDER BY name;


-- ─── 2. Buscar las 4 citas por paciente + fecha ───────────────────────────────
SELECT
    a.id              AS appointment_id,
    p.name            AS paciente,
    a.date            AS fecha,
    a.status          AS estado,
    a.paid            AS pagada,
    a.amount          AS importe,
    a."treatmentName" AS tratamiento,
    d.name            AS doctor_asignado,
    a."doctorId"      AS doctor_id
FROM "Appointment" a
JOIN  "Patient" p ON p.id = a."patientId"
LEFT JOIN "Doctor"  d ON d.id = a."doctorId"
WHERE a.date IN ('2026-04-20', '2026-04-21')
  AND a."deleted_at" IS NULL
  AND (
      p.name ILIKE '%enrique%martin%'
   OR p.name ILIKE '%jose%moreno%'
   OR p.name ILIKE '%ma%jose%moreno%'
   OR p.name ILIKE '%eduardo%dimas%'
   OR p.name ILIKE '%paulo%castro%'
   OR p.name ILIKE '%paulo%de%castro%'
  )
ORDER BY a.date, p.name;


-- ─── 3. Verificar si existe alguna liquidación para esas citas ────────────────
-- (ejecutar después de anotar los appointment_id del paso anterior)
SELECT
    l.id              AS liquidation_id,
    l."doctorId"      AS liq_doctor_id,
    ld.name           AS liq_doctor_nombre,
    l."grossAmount"   AS bruto,
    l."finalAmount"   AS comision,
    l."treatmentName" AS tratamiento,
    l."patientName"   AS paciente,
    l."createdAt"     AS fecha_proceso,
    l."manuallyEdited"
FROM "Liquidation" l
LEFT JOIN "Doctor" ld ON ld.id = l."doctorId"
WHERE l."appointmentId" IN (
    SELECT a.id
    FROM "Appointment" a
    JOIN "Patient" p ON p.id = a."patientId"
    WHERE a.date IN ('2026-04-20', '2026-04-21')
      AND a."deleted_at" IS NULL
      AND (
          p.name ILIKE '%enrique%martin%'
       OR p.name ILIKE '%jose%moreno%'
       OR p.name ILIKE '%ma%jose%moreno%'
       OR p.name ILIKE '%eduardo%dimas%'
       OR p.name ILIKE '%paulo%castro%'
       OR p.name ILIKE '%paulo%de%castro%'
      )
)
ORDER BY l."createdAt";


-- ─── 4. Verificar pagos (Payment) para esas citas ────────────────────────────
SELECT
    pay.id            AS payment_id,
    pay.amount        AS importe,
    pay.method        AS metodo,
    pay.type          AS tipo,
    pay."createdAt"   AS fecha,
    p.name            AS paciente,
    a.date            AS cita_fecha,
    a."treatmentName" AS tratamiento,
    inv."invoiceNumber"
FROM "Payment" pay
JOIN  "Appointment" a   ON a.id   = pay."appointmentId"
JOIN  "Patient"     p   ON p.id   = pay."patientId"
LEFT JOIN "Invoice"     inv ON inv."relatedPaymentId" = pay.id
                            OR inv."appointmentId"    = a.id
WHERE a.date IN ('2026-04-20', '2026-04-21')
  AND a."deleted_at" IS NULL
  AND (
      p.name ILIKE '%enrique%martin%'
   OR p.name ILIKE '%jose%moreno%'
   OR p.name ILIKE '%ma%jose%moreno%'
   OR p.name ILIKE '%eduardo%dimas%'
   OR p.name ILIKE '%paulo%castro%'
   OR p.name ILIKE '%paulo%de%castro%'
  )
ORDER BY a.date, p.name;


-- ─── 5. Resumen: citas pagadas de Abigail en abril SIN liquidación ────────────
-- (usa el doctorId obtenido en el paso 1 para reemplazar 'ABIGAIL_DOCTOR_ID')
SELECT
    a.id              AS appointment_id,
    p.name            AS paciente,
    a.date            AS fecha,
    a.amount          AS importe,
    a."treatmentName" AS tratamiento,
    a.paid,
    a.status
FROM "Appointment" a
JOIN "Patient" p ON p.id = a."patientId"
WHERE a."doctorId" = 'ABIGAIL_DOCTOR_ID'   -- ← reemplazar con el id del paso 1
  AND a.date >= '2026-04-01'
  AND a.date <= '2026-04-30'
  AND a."deleted_at" IS NULL
  AND NOT EXISTS (
      SELECT 1 FROM "Liquidation" l
      WHERE l."appointmentId" = a.id
  )
ORDER BY a.date;
