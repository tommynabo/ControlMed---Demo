-- Migration: Add ODA (Referido por Clínica Externa) flag to Patient
-- ODA patients have a 10% referral commission automatically applied to their budgets.
ALTER TABLE "Patient"
  ADD COLUMN IF NOT EXISTS "isODA" BOOLEAN NOT NULL DEFAULT FALSE;

-- Index for quick filtering of ODA patients
CREATE INDEX IF NOT EXISTS "Patient_isODA_idx" ON "Patient" ("isODA") WHERE "isODA" = TRUE;
