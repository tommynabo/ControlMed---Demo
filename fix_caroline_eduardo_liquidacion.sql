-- ============================================================
-- CORRECCIÓN: Liquidaciones incorrectas Dra. Caroline Castaño
-- Paciente: ECHALE LEAD / Eduardo Gega Zambale
-- Cita: 29/04/2026 — Pago monedero 127,50 €
-- Concepto correcto: ESTUDIO ORTODONTICO
--
-- El problema: el sistema creó 5 filas de liquidación (una por
-- cada item del presupuesto completo de ortodoncia) en lugar de
-- una sola para el concepto cobrado.
--
-- INSTRUCCIONES: ejecutar paso a paso en Supabase SQL Editor.
-- Revisar los resultados de los SELECTs antes de borrar/insertar.
-- ============================================================


-- ── PASO 1: Identificar al paciente ─────────────────────────────────────────
SELECT id, name, "historyNumber"
FROM "Patient"
WHERE name ILIKE '%Eduardo%Gega%' OR name ILIKE '%Échale%Eduardo%' OR name ILIKE '%Echale%Eduardo%'
LIMIT 5;

-- ── PASO 2: Identificar a la doctora Caroline Castaño ───────────────────────
SELECT id, name
FROM "Doctor"
WHERE name ILIKE '%Caroline%' OR name ILIKE '%Castaño%' OR name ILIKE '%Castano%'
LIMIT 5;

-- ── PASO 3: Identificar la cita del 29/04/2026 ──────────────────────────────
-- Reemplaza <PATIENT_ID> y <DOCTOR_ID> con los IDs obtenidos en los pasos 1 y 2
SELECT id, date, time, "treatmentName", amount, paid, "budgetId", "budgetItemIds", "doctorId"
FROM "Appointment"
WHERE date = '2026-04-29'
  AND "patientId" = '<PATIENT_ID>'
  AND "doctorId"  = '<DOCTOR_ID>'
  AND "deleted_at" IS NULL
ORDER BY time DESC
LIMIT 5;

-- ── PASO 4: Ver el pago de monedero asociado ────────────────────────────────
-- Reemplaza <APPT_ID> con el id de la cita del paso 3
SELECT id, amount, method, type, "createdAt", "doctorId", "appointmentId"
FROM "Payment"
WHERE "appointmentId" = '<APPT_ID>'
ORDER BY "createdAt" DESC;

-- ── PASO 5: Ver las liquidaciones incorrectas ───────────────────────────────
SELECT id, "doctorId", "grossAmount", "treatmentName", "itemIndex", "paymentMethod", "createdAt", "paymentId"
FROM "Liquidation"
WHERE "appointmentId" = '<APPT_ID>'
ORDER BY "itemIndex" NULLS LAST;

-- ============================================================
-- *** REVISIÓN: Confirma que ves 5 filas con itemIndex 0,1,2,3,4
-- y montos extraños (4.13, 68.84, etc.). Si es así, continúa.
-- ============================================================


-- ── PASO 6: BORRAR las filas multi-concepto incorrectas ─────────────────────
-- Solo borra las que tienen itemIndex NOT NULL (las 5 incorrectas).
-- La fila con itemIndex IS NULL (si existe) es la correcta y se conserva.
DELETE FROM "Liquidation"
WHERE "appointmentId" = '<APPT_ID>'
  AND "itemIndex" IS NOT NULL;

-- Verificar que se borraron:
SELECT COUNT(*) AS "filas_restantes", "itemIndex"
FROM "Liquidation"
WHERE "appointmentId" = '<APPT_ID>'
GROUP BY "itemIndex";


-- ── PASO 7: Crear / corregir la fila de liquidación correcta ────────────────
-- Primero verificamos si ya existe una fila con itemIndex IS NULL
SELECT id, "grossAmount", "treatmentName", "finalAmount", "commissionRate"
FROM "Liquidation"
WHERE "appointmentId" = '<APPT_ID>'
  AND "itemIndex" IS NULL;

-- Si NO existe ninguna fila (0 resultados), insertar la correcta:
-- (Si ya existe una fila correcta con itemIndex NULL, usar el UPDATE más abajo)
INSERT INTO "Liquidation" (
    id,
    "doctorId",
    "appointmentId",
    "paymentId",
    "itemIndex",
    "grossAmount",
    "baseAmount",
    "labCost",
    "commissionRate",
    "finalAmount",
    "referralCommission",
    "referralEntityName",
    "treatmentName",
    "patientName",
    "paymentMethod",
    status,
    "createdAt"
)
SELECT
    gen_random_uuid(),
    '<DOCTOR_ID>',           -- Caroline Castaño
    '<APPT_ID>',
    p.id,                    -- Payment id del paso 4
    NULL,                    -- itemIndex = NULL → fila mono-concepto
    127.50,                  -- grossAmount correcto
    127.50,                  -- baseAmount
    0,                       -- labCost
    d."commissionPercentage",
    ROUND(127.50 * d."commissionPercentage" / 100.0, 4),
    0,
    NULL,
    'ESTUDIO ORTODONTICO',   -- concepto correcto
    pat.name,
    'wallet',
    'PENDING',
    '2026-04-29T12:00:00.000Z'
FROM "Doctor" d
CROSS JOIN "Patient" pat
CROSS JOIN "Payment" p
WHERE d.id   = '<DOCTOR_ID>'
  AND pat.id = '<PATIENT_ID>'
  AND p."appointmentId" = '<APPT_ID>'
  AND p.method = 'wallet'
  AND NOT EXISTS (
      SELECT 1 FROM "Liquidation"
      WHERE "appointmentId" = '<APPT_ID>'
        AND "itemIndex" IS NULL
  )
LIMIT 1;

-- Si SÍ existía una fila con itemIndex NULL pero con importe incorrecto, actualizar:
UPDATE "Liquidation"
SET
    "grossAmount"    = 127.50,
    "baseAmount"     = 127.50,
    "labCost"        = 0,
    "finalAmount"    = ROUND(127.50 * "commissionRate" / 100.0, 4),
    "treatmentName"  = 'ESTUDIO ORTODONTICO',
    "paymentMethod"  = 'wallet',
    status           = 'PENDING'
WHERE "appointmentId" = '<APPT_ID>'
  AND "itemIndex" IS NULL
  AND ("grossAmount" <> 127.50 OR "treatmentName" <> 'ESTUDIO ORTODONTICO');


-- ── PASO 8: Verificación final ───────────────────────────────────────────────
SELECT
    l.id,
    l."grossAmount",
    l."finalAmount",
    l."commissionRate",
    l."treatmentName",
    l."itemIndex",
    l."paymentMethod",
    l.status,
    l."createdAt"
FROM "Liquidation" l
WHERE l."appointmentId" = '<APPT_ID>'
ORDER BY l."itemIndex" NULLS LAST;

-- Resultado esperado: 1 sola fila con:
--   grossAmount = 127.50
--   treatmentName = 'ESTUDIO ORTODONTICO'
--   itemIndex = NULL
--   paymentMethod = 'wallet'
--   status = 'PENDING'
