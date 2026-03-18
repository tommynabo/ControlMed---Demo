-- Migration: Partial Payments & Visit Management Support
-- Feature 2: Fractional (partial) payments for appointments
-- Feature 1: Visit status tracking
-- Run in: https://supabase.com/dashboard/project/gnnacijqglcqonholpwt/sql

-- =========================================================
-- 1. Allow multiple invoices per appointment (partial payments)
-- =========================================================
-- The Invoice table has a unique constraint on appointmentId which prevents
-- multiple partial payment invoices for the same appointment.
-- For partial payments, we set appointmentId = NULL on the invoice,
-- so no migration is strictly needed. This SQL is here as documentation.

-- =========================================================
-- 2. Add 'EN_PROCESO' as a valid status for Appointment
-- =========================================================
-- Most DB setups store status as a varchar, so this is usually fine.
-- If your Appointment.status is an ENUM, run the following:

-- ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'EN_PROCESO';

-- If status is just a text/varchar column with a CHECK constraint:
-- ALTER TABLE "Appointment" DROP CONSTRAINT IF EXISTS appointment_status_check;
-- ALTER TABLE "Appointment" ADD CONSTRAINT appointment_status_check
--   CHECK (status IN ('Scheduled', 'PENDIENTE', 'EN_PROCESO', 'COMPLETADO', 'PRESUPUESTADO', 'Completed', 'CANCELLED'));

-- =========================================================
-- 3. Add paidAmount column to Appointment for partial payment tracking
-- =========================================================
-- This lets the clinic know how much has been paid so far for a given visit.

ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "paidAmount" NUMERIC(10, 2) DEFAULT 0;

-- Update existing completed/paid appointments to reflect their amount as paidAmount
UPDATE "Appointment"
SET "paidAmount" = COALESCE(amount, 0)
WHERE paid = true AND "paidAmount" = 0;

-- =========================================================
-- 4. Add partial payment flag to Payment record
-- =========================================================
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "isPartial" BOOLEAN DEFAULT FALSE;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "originalAmount" NUMERIC(10, 2);

-- =========================================================
-- 5. Verify the Appointment table structure
-- =========================================================
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'Appointment'
ORDER BY ordinal_position;
