-- ============================================================================
-- FIX: Corrección de fecha — Tomas Meco Durban
-- La cita aparece como 22/04/2026 en el sistema pero la visita fue 20/04/2026
-- ============================================================================
-- Contexto:
--   Las fechas en ControlMed a veces no coinciden con la fecha real de la visita
--   porque la cita se registra o edita al día siguiente. Este script corrige la
--   fecha en la Appointment Y en el createdAt de la Liquidation asociada para
--   que la liquidación cuadre con los registros físicos de la clínica.
--
-- INSTRUCCIONES:
--   1. Ejecutar PASO 1 para confirmar los IDs y valores actuales.
--   2. Revisar el resultado. Si la fecha mostrada es 22/04 → ejecutar PASO 2.
--   3. Verificar con PASO 3.
--   ⚠️  Si la fecha ya es 20/04 NO ejecutar el PASO 2.
--
-- ⚠️  Ejecutar en Supabase → SQL Editor
-- ============================================================================


-- ─── PASO 1: Verificar estado actual de Tomas Meco ───────────────────────────
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
    l."finalAmount",
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


-- ─── PASO 2: Corregir la fecha de la cita: 22/04 → 20/04 ────────────────────
-- Ejecutar solo si PASO 1 confirma que la fecha es 22/04/2026.

-- 2a. Corregir la fecha en la Appointment
UPDATE "Appointment"
SET date = '2026-04-20'
WHERE id IN (
    SELECT a.id
    FROM "Appointment" a
    JOIN "Patient" p ON p.id = a."patientId"
    WHERE p.name ILIKE '%tomas%meco%'
      AND a.date::date = '2026-04-22'
      AND a."deleted_at" IS NULL
);

-- 2b. Ajustar el createdAt de la Liquidation para que quede en el día correcto
--     (mantiene la hora original, solo cambia el día)
UPDATE "Liquidation"
SET "createdAt" = (
    -- Reemplaza solo la parte de fecha, preserva la hora
    ('2026-04-20'::date + ("createdAt"::time))::timestamp
)
WHERE "appointmentId" IN (
    SELECT a.id
    FROM "Appointment" a
    JOIN "Patient" p ON p.id = a."patientId"
    WHERE p.name ILIKE '%tomas%meco%'
      AND a."deleted_at" IS NULL
)
  AND "createdAt"::date = '2026-04-22';


-- ─── PASO 3: Verificación final ──────────────────────────────────────────────
-- Resultado esperado: cita_fecha_sistema = 2026-04-20, liq_fecha = 2026-04-20.
SELECT
    a.date            AS cita_fecha_sistema,
    l."createdAt"     AS liq_fecha_proceso,
    l."patientName",
    l."grossAmount",
    l."finalAmount"
FROM "Appointment" a
JOIN  "Patient" p    ON p.id   = a."patientId"
LEFT JOIN "Liquidation" l ON l."appointmentId" = a.id
WHERE p.name ILIKE '%tomas%meco%'
  AND a."deleted_at" IS NULL;


-- ============================================================================
-- NOTA GENERAL: Fechas en ControlMed vs. realidad
-- ============================================================================
-- Si en el futuro hay más casos de citas con fecha incorrecta, el patrón es:
--
--   UPDATE "Appointment" SET date = '<fecha_correcta>' WHERE id = '<id_cita>';
--   UPDATE "Liquidation"
--     SET "createdAt" = ('<fecha_correcta>'::date + ("createdAt"::time))::timestamp
--     WHERE "appointmentId" = '<id_cita>';
--
-- La fecha de la Invoice NO se modifica aquí porque afecta al cierre de caja
-- del día en que se cobró. Solo se corrige si hay discrepancia confirmada.
-- ============================================================================
