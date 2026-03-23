-- Renombrar tablas de PascalCase a snake_case
-- Ejecutar en Supabase SQL Editor: https://supabase.com/dashboard/project/gnnacijqglcqonholpwt/sql

-- Esto corrige el error: "Could not find the table 'public.clinical_treatment_plans'"

ALTER TABLE IF EXISTS "ClinicalTreatmentPlan" RENAME TO clinical_treatment_plans;
ALTER TABLE IF EXISTS "ClinicalTreatmentStep" RENAME TO clinical_treatment_steps;

-- Verificar que quedaron bien:
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('clinical_treatment_plans', 'clinical_treatment_steps');
