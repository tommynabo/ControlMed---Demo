-- ============================================================
-- RGPD Soft-Delete Migration
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ============================================================

-- 1. Patient table
ALTER TABLE "Patient"
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Appointment table
ALTER TABLE "Appointment"
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 3. ClinicalRecord table
ALTER TABLE "ClinicalRecord"
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 4. Budget table
ALTER TABLE "Budget"
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 5. Prescription table (if it exists)
ALTER TABLE "Prescription"
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- ============================================================
-- Indexes for fast filtering on deleted_at IS NULL
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_patient_deleted_at        ON "Patient"        (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_appointment_deleted_at    ON "Appointment"    (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_clinical_record_deleted_at ON "ClinicalRecord" (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_budget_deleted_at         ON "Budget"         (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_prescription_deleted_at   ON "Prescription"   (deleted_at) WHERE deleted_at IS NULL;

-- ============================================================
-- Optional: Row Level Security policy to auto-hide deleted rows
-- (if you want to enforce at DB level, not just application level)
-- ============================================================
-- ALTER TABLE "Patient" ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "hide_deleted_patients" ON "Patient"
--   FOR SELECT USING (deleted_at IS NULL);
