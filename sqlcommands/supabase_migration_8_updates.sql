-- ======================================================================
-- CRM MÉDICO - MIGRACIÓN: 8 ACTUALIZACIONES FEBRERO 2026
-- ======================================================================
-- Ejecutar en Supabase SQL Editor
-- Cubre: Plan Tratamiento, Agenda Closures, Visit Details
-- ======================================================================

-- ===== 1. PLAN DE TRATAMIENTO CLÍNICO =====

CREATE TABLE IF NOT EXISTS clinical_treatment_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL,
    name TEXT NOT NULL DEFAULT 'Plan de Tratamiento',
    status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, COMPLETED, CANCELLED
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS clinical_treatment_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES clinical_treatment_plans(id) ON DELETE CASCADE,
    step_order INT NOT NULL DEFAULT 0,
    treatment_name TEXT NOT NULL,
    tooth_id INT, -- Número del diente (opcional)
    status TEXT NOT NULL DEFAULT 'PENDIENTE', -- PENDIENTE, EN_PROCESO, COMPLETADO
    notes TEXT,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clinical_plans_patient ON clinical_treatment_plans(patient_id);
CREATE INDEX IF NOT EXISTS idx_clinical_steps_plan ON clinical_treatment_steps(plan_id);

-- ===== 4. ANULACIÓN / APERTURA DE AGENDAS =====

CREATE TABLE IF NOT EXISTS agenda_closures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    doctor_id TEXT, -- NULL = all doctors closed for that day
    reason TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agenda_closures_date ON agenda_closures(date);

-- ===== 7. DETALLES DE LA VISITA (appointments) =====

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Appointment' AND column_name = 'visitDetails'
    ) THEN
        ALTER TABLE "Appointment" ADD COLUMN "visitDetails" TEXT;
    END IF;
END $$;

-- Also try lowercase table (depends on Prisma naming)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'appointment' AND column_name = 'visitDetails'
    ) THEN
        ALTER TABLE "appointment" ADD COLUMN "visitDetails" TEXT;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Table might not exist with lowercase name, ignore
    NULL;
END $$;

-- ===== 3. PAGO COMBINADO (payment_breakdown on Payment) =====

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Payment' AND column_name = 'paymentBreakdown'
    ) THEN
        ALTER TABLE "Payment" ADD COLUMN "paymentBreakdown" JSONB;
    END IF;
END $$;

-- ===== DONE =====
-- All migrations applied. The application is now ready for the 8 updates.
