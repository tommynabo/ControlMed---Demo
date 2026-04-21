-- ============================================================================
-- EDITAR PAGO DESDE LIQUIDACIONES (uso temporal hasta que cargue el nuevo UI)
-- ============================================================================
--
-- Úsalo desde Supabase SQL Editor para modificar doctor, concepto e importe
-- de cualquier pago sin necesidad de pasar por el frontend.
--
-- INSTRUCCIONES:
--   1. Ejecuta el SELECT de búsqueda para encontrar el payment_id del cobro.
--   2. Copia el id que devuelva.
--   3. Pégalo en el UPDATE y ajusta los valores que quieras cambiar.
-- ============================================================================

-- ─── PASO 1: Buscar el cobro por paciente y fecha ───────────────────────────
--   Ajusta el nombre del paciente y la fecha según necesites.

SELECT
    p.id             AS payment_id,
    p.amount,
    p.notes          AS concepto,
    p."createdAt"::date AS fecha,
    p."doctorId",
    d.name           AS doctor_nombre,
    pat.name         AS paciente
FROM "Payment" p
JOIN "Patient" pat ON pat.id = p."patientId"
LEFT JOIN "Doctor" d ON d.id = p."doctorId"
WHERE pat.name ILIKE '%nombre del paciente%'   -- ← cambia esto
  AND p."createdAt"::date = '2026-04-21'        -- ← cambia la fecha
ORDER BY p."createdAt" DESC;


-- ─── PASO 2: Actualizar el pago ─────────────────────────────────────────────
--   Pega el id del paso anterior en WHERE id = '...'
--   Solo cambia los campos que necesites; el resto déjalos igual.

UPDATE "Payment"
SET
    "doctorId" = 'ID_DEL_NUEVO_DOCTOR',         -- ← id del doctor (de la tabla Doctor)
    notes      = 'Nuevo concepto del tratamiento',  -- ← texto que aparece en Concepto
    amount     = 175                             -- ← importe correcto en €
WHERE id = 'PEGA_AQUI_EL_PAYMENT_ID';


-- ─── PASO 2b (opcional): Sincronizar la factura vinculada ───────────────────
--   Solo necesario si cambias el importe.

UPDATE "Invoice"
SET amount = 175                                 -- ← mismo importe que arriba
WHERE id = (
    SELECT "invoiceId" FROM "Payment"
    WHERE id = 'PEGA_AQUI_EL_PAYMENT_ID'
);


-- ─── PASO 3: Verificar resultado ─────────────────────────────────────────────

SELECT
    p.id,
    p.amount,
    p.notes          AS concepto,
    p."createdAt"::date AS fecha,
    d.name           AS doctor,
    pat.name         AS paciente
FROM "Payment" p
JOIN "Patient" pat ON pat.id = p."patientId"
LEFT JOIN "Doctor" d ON d.id = p."doctorId"
WHERE p.id = 'PEGA_AQUI_EL_PAYMENT_ID';


-- ─── EXTRA: Listar todos los doctores con sus ids ───────────────────────────
--   Útil para encontrar el doctorId correcto en el paso 2.

SELECT id, name FROM "Doctor" ORDER BY name;
