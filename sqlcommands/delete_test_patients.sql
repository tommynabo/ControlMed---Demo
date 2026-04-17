-- ============================================================================
-- ELIMINAR PACIENTES DE PRUEBA
-- Pacientes objetivo:
--   1. "Tomás Navarro" (nombre exacto, también variantes sin tilde)
--   2. Cualquier paciente cuyo nombre contenga "ejemplo" (insensible a mayúsculas)
--
-- INSTRUCCIONES:
--   1. Ejecutar en Supabase → SQL Editor
--   2. Primero ejecuta el bloque VERIFICACIÓN para confirmar qué se va a borrar
--   3. Luego ejecuta el bloque ELIMINACIÓN
--
-- ORDEN DE BORRADO (respeta foreign keys):
--   clinical_treatment_steps → clinical_treatment_plans
--   "BudgetLineItem"         → "Budget"
--   "InvoiceItem"            → "Invoice"
--   "Installment"            → "TreatmentPlan"
--   "Liquidation"            → "Appointment"
--   "Payment"                (directo + vía appointmentId)
--   "PatientTreatment"
--   "ClinicalRecord"
--   "DentalSnapshot"
--   "Odontogram"
--   "Appointment"
--   "Invoice"
--   "TreatmentPlan"
--   "Budget"
--   clinical_treatment_plans
--   "Patient"                ← último
-- ============================================================================


-- ============================================================================
-- PASO 1: VERIFICACIÓN (solo lectura — ejecuta esto primero para confirmar)
-- ============================================================================

SELECT id, name, email, "createdAt"
FROM "Patient"
WHERE
    name ILIKE '%tomas navarro%'
    OR name ILIKE '%tomás navarro%'
    OR name ILIKE '%ejemplo%';


-- ============================================================================
-- PASO 2: ELIMINACIÓN (ejecuta este bloque después de confirmar los nombres)
-- ============================================================================

DO $$
DECLARE
    v_patient_ids TEXT[];
    v_patient_id  TEXT;
    v_invoice_ids TEXT[];
    v_budget_ids  TEXT[];
    v_plan_ids    TEXT[];
    v_appt_ids    TEXT[];
    v_ctp_ids     UUID[];
BEGIN

    -- ── 0. Recopilar IDs de los pacientes a eliminar ─────────────────────────
    SELECT array_agg(id)
    INTO v_patient_ids
    FROM "Patient"
    WHERE
        name ILIKE '%tomas navarro%'
        OR name ILIKE '%tomás navarro%'
        OR name ILIKE '%ejemplo%';

    IF v_patient_ids IS NULL OR array_length(v_patient_ids, 1) = 0 THEN
        RAISE NOTICE 'No se encontraron pacientes de prueba. Nada que eliminar.';
        RETURN;
    END IF;

    RAISE NOTICE 'Pacientes a eliminar: %', v_patient_ids;

    -- ── 1. clinical_treatment_steps → clinical_treatment_plans ───────────────
    -- (clinical_treatment_plans usa patient_id como UUID; cast seguro)
    BEGIN
        SELECT array_agg(id)
        INTO v_ctp_ids
        FROM clinical_treatment_plans
        WHERE patient_id::TEXT = ANY(v_patient_ids);

        IF v_ctp_ids IS NOT NULL THEN
            DELETE FROM clinical_treatment_steps
            WHERE plan_id = ANY(v_ctp_ids);

            DELETE FROM clinical_treatment_plans
            WHERE id = ANY(v_ctp_ids);

            RAISE NOTICE 'Eliminados % planes clínicos y sus pasos', array_length(v_ctp_ids, 1);
        END IF;
    EXCEPTION WHEN undefined_table THEN
        RAISE NOTICE 'Tabla clinical_treatment_plans no existe, omitiendo...';
    END;

    -- ── 2. Liquidations → Appointments ───────────────────────────────────────
    SELECT array_agg(id)
    INTO v_appt_ids
    FROM "Appointment"
    WHERE "patientId" = ANY(v_patient_ids);

    IF v_appt_ids IS NOT NULL THEN
        DELETE FROM "Liquidation"
        WHERE "appointmentId" = ANY(v_appt_ids);
        RAISE NOTICE 'Eliminadas liquidaciones de % citas', array_length(v_appt_ids, 1);
    END IF;

    -- ── 3. InvoiceItems → Invoices ────────────────────────────────────────────
    SELECT array_agg(id)
    INTO v_invoice_ids
    FROM "Invoice"
    WHERE "patientId" = ANY(v_patient_ids);

    IF v_invoice_ids IS NOT NULL THEN
        DELETE FROM "InvoiceItem"
        WHERE "invoiceId" = ANY(v_invoice_ids);
        RAISE NOTICE 'Eliminados items de % facturas', array_length(v_invoice_ids, 1);
    END IF;

    -- ── 4. Installments → TreatmentPlans ─────────────────────────────────────
    SELECT array_agg(id)
    INTO v_plan_ids
    FROM "TreatmentPlan"
    WHERE "patientId" = ANY(v_patient_ids);

    IF v_plan_ids IS NOT NULL THEN
        DELETE FROM "Installment"
        WHERE "planId" = ANY(v_plan_ids);
        RAISE NOTICE 'Eliminadas cuotas de % planes de tratamiento', array_length(v_plan_ids, 1);
    END IF;

    -- ── 5. BudgetLineItems → Budgets ──────────────────────────────────────────
    SELECT array_agg(id)
    INTO v_budget_ids
    FROM "Budget"
    WHERE "patientId" = ANY(v_patient_ids);

    IF v_budget_ids IS NOT NULL THEN
        DELETE FROM "BudgetLineItem"
        WHERE "budgetId" = ANY(v_budget_ids);
        RAISE NOTICE 'Eliminadas líneas de % presupuestos', array_length(v_budget_ids, 1);
    END IF;

    -- ── 6. Payments ───────────────────────────────────────────────────────────
    DELETE FROM "Payment"
    WHERE "patientId" = ANY(v_patient_ids);
    RAISE NOTICE 'Eliminados pagos de los pacientes';

    -- Payments vinculados vía appointmentId (por si acumen)
    IF v_appt_ids IS NOT NULL THEN
        DELETE FROM "Payment"
        WHERE "appointmentId" = ANY(v_appt_ids);
    END IF;

    -- ── 7. PatientTreatments ──────────────────────────────────────────────────
    DELETE FROM "PatientTreatment"
    WHERE "patientId" = ANY(v_patient_ids);
    RAISE NOTICE 'Eliminados tratamientos asignados a los pacientes';

    -- ── 8. ClinicalRecords ────────────────────────────────────────────────────
    DELETE FROM "ClinicalRecord"
    WHERE "patientId" = ANY(v_patient_ids);
    RAISE NOTICE 'Eliminados registros clínicos de los pacientes';

    -- ── 9. DentalSnapshots ────────────────────────────────────────────────────
    BEGIN
        DELETE FROM "DentalSnapshot"
        WHERE "patientId" = ANY(v_patient_ids);
        RAISE NOTICE 'Eliminados snapshots dentales';
    EXCEPTION WHEN undefined_table THEN
        RAISE NOTICE 'Tabla DentalSnapshot no existe, omitiendo...';
    END;

    -- ── 10. Odontograms ───────────────────────────────────────────────────────
    BEGIN
        DELETE FROM "Odontogram"
        WHERE "patientId" = ANY(v_patient_ids);
        RAISE NOTICE 'Eliminados odontogramas';
    EXCEPTION WHEN undefined_table THEN
        RAISE NOTICE 'Tabla Odontogram no existe, omitiendo...';
    END;

    -- ── 11. Appointments ──────────────────────────────────────────────────────
    DELETE FROM "Appointment"
    WHERE "patientId" = ANY(v_patient_ids);
    RAISE NOTICE 'Eliminadas citas de los pacientes';

    -- ── 12. Invoices ──────────────────────────────────────────────────────────
    IF v_invoice_ids IS NOT NULL THEN
        DELETE FROM "Invoice"
        WHERE id = ANY(v_invoice_ids);
        RAISE NOTICE 'Eliminadas % facturas', array_length(v_invoice_ids, 1);
    END IF;

    -- ── 13. TreatmentPlans ────────────────────────────────────────────────────
    IF v_plan_ids IS NOT NULL THEN
        DELETE FROM "TreatmentPlan"
        WHERE id = ANY(v_plan_ids);
        RAISE NOTICE 'Eliminados % planes de tratamiento', array_length(v_plan_ids, 1);
    END IF;

    -- ── 14. Budgets ───────────────────────────────────────────────────────────
    IF v_budget_ids IS NOT NULL THEN
        DELETE FROM "Budget"
        WHERE id = ANY(v_budget_ids);
        RAISE NOTICE 'Eliminados % presupuestos', array_length(v_budget_ids, 1);
    END IF;

    -- ── 15. Patients (el registro principal) ──────────────────────────────────
    DELETE FROM "Patient"
    WHERE id = ANY(v_patient_ids);

    RAISE NOTICE '✅ COMPLETADO: % pacientes de prueba eliminados correctamente.', array_length(v_patient_ids, 1);

END $$;


-- ============================================================================
-- PASO 3: VERIFICACIÓN POST-BORRADO (confirma que no quedan registros)
-- ============================================================================

-- Debe devolver 0 filas:
SELECT id, name FROM "Patient"
WHERE
    name ILIKE '%tomas navarro%'
    OR name ILIKE '%tomás navarro%'
    OR name ILIKE '%ejemplo%';
