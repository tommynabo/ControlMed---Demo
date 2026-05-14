-- ============================================================================
-- DIAGNÓSTICO: Presupuestos que aparecen en liquidaciones de Mayo 2026
-- ============================================================================
-- Propósito: identificar qué filas de Liquidation tienen concepto "Presupuesto"
--   o están ligadas a citas con status PRESUPUESTADO, para eliminarlas o
--   corregirlas antes de generar los informes del mes.
--
-- ⚠️  Solo lectura — ejecutar en Supabase → SQL Editor (no modifica nada).
-- ============================================================================


-- ─── 1. Liquidaciones de Mayo cuyo concepto contiene "presupuest" ─────────────
SELECT
    l.id              AS liquidation_id,
    l."doctorId"      AS doctor_id,
    d.name            AS doctor_nombre,
    l."treatmentName" AS concepto,
    l."patientName"   AS paciente,
    l."grossAmount"   AS bruto,
    l."finalAmount"   AS comision,
    l."paymentMethod" AS metodo,
    l."createdAt"     AS fecha_proceso,
    a.date            AS cita_fecha,
    a.status          AS cita_estado,
    a.paid            AS cita_pagada
FROM "Liquidation" l
LEFT JOIN "Doctor"      d ON d.id = l."doctorId"
LEFT JOIN "Appointment" a ON a.id = l."appointmentId"
WHERE (
    LOWER(l."treatmentName") LIKE '%presupuest%'
    OR LOWER(l."treatmentName") LIKE '%budget%'
)
AND (
    -- Creada en mayo 2026
    l."createdAt" >= '2026-05-01'
    -- O la cita vinculada es de mayo 2026
    OR (a.date >= '2026-05-01' AND a.date <= '2026-05-31')
)
ORDER BY d.name, l."createdAt";


-- ─── 2. Liquidaciones ligadas a citas con status PRESUPUESTADO ───────────────
SELECT
    l.id              AS liquidation_id,
    l."doctorId"      AS doctor_id,
    d.name            AS doctor_nombre,
    l."treatmentName" AS concepto,
    l."patientName"   AS paciente,
    l."grossAmount"   AS bruto,
    l."finalAmount"   AS comision,
    l."createdAt"     AS fecha_proceso,
    a.id              AS cita_id,
    a.date            AS cita_fecha,
    a.status          AS cita_estado,
    a.paid            AS cita_pagada
FROM "Liquidation" l
JOIN "Appointment" a ON a.id = l."appointmentId"
LEFT JOIN "Doctor"  d ON d.id = l."doctorId"
WHERE a.status = 'PRESUPUESTADO'
ORDER BY d.name, a.date;


-- ─── 3. Todas las liquidaciones de Mayo 2026 (para revisar manualmente) ───────
SELECT
    l.id              AS liquidation_id,
    d.name            AS doctor,
    l."treatmentName" AS concepto,
    l."patientName"   AS paciente,
    l."grossAmount"   AS bruto,
    l."finalAmount"   AS comision,
    l."createdAt"     AS fecha_proceso,
    a.date            AS cita_fecha,
    a.status          AS cita_estado
FROM "Liquidation" l
LEFT JOIN "Doctor"      d ON d.id = l."doctorId"
LEFT JOIN "Appointment" a ON a.id = l."appointmentId"
WHERE (
    (a.date >= '2026-05-01' AND a.date <= '2026-05-31')
    OR (l."appointmentId" IS NULL AND l."createdAt" >= '2026-05-01' AND l."createdAt" < '2026-06-01')
)
ORDER BY d.name, COALESCE(a.date, l."createdAt"::date);


-- ─── 4. Citas de Mayo 2026 con paid=true pero status=PRESUPUESTADO ───────────
-- Estas son el origen más probable del problema
SELECT
    a.id              AS appointment_id,
    p.name            AS paciente,
    a.date            AS fecha,
    a.status          AS estado,
    a.paid,
    a.amount          AS importe,
    a."treatmentName" AS tratamiento,
    d.name            AS doctor
FROM "Appointment" a
JOIN  "Patient" p ON p.id = a."patientId"
LEFT JOIN "Doctor"  d ON d.id = a."doctorId"
WHERE a.date >= '2026-05-01'
  AND a.date <= '2026-05-31'
  AND a."deleted_at" IS NULL
  AND a.status = 'PRESUPUESTADO'
  AND a.paid = TRUE
ORDER BY a.date;


-- ─── 5. Script de limpieza (COMENTADO — revisar primero) ─────────────────────
-- Una vez identificadas las filas incorrectas en los pasos 1-4,
-- DESCOMENTAR y ADAPTAR el siguiente DELETE con los IDs concretos.
--
-- ⚠️  PRECAUCIÓN: hacer backup o anotar los IDs antes de borrar.
--
/*
DELETE FROM "Liquidation"
WHERE id IN (
    'ID_LIQUIDACION_1',
    'ID_LIQUIDACION_2'
    -- ... añadir más IDs según el resultado del diagnóstico
);
*/

-- Si la cita vinculada también hay que corregir su estado:
/*
UPDATE "Appointment"
SET paid = FALSE, status = 'PRESUPUESTADO'
WHERE id IN (
    'APPOINTMENT_ID_1'
    -- ...
)
AND status = 'PRESUPUESTADO';   -- solo si no se llegó a realizar
*/
