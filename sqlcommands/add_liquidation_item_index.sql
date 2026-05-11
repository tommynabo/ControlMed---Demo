-- Migration: Split multi-concept Liquidation rows
-- Run this in the Supabase SQL editor BEFORE deploying the updated server code.

-- 1. Add itemIndex column (NULL = single-concept legacy row, 0/1/2... = per-item rows)
ALTER TABLE "Liquidation" ADD COLUMN IF NOT EXISTS "itemIndex" INTEGER;

-- 2. Drop ALL known unique constraints that block multiple rows per appointment
ALTER TABLE "Liquidation" DROP CONSTRAINT IF EXISTS "Liquidation_appointmentId_doctorId_key";
ALTER TABLE "Liquidation" DROP CONSTRAINT IF EXISTS "Liquidation_appointmentId_key";
DROP INDEX IF EXISTS "Liquidation_appointmentId_key";
DROP INDEX IF EXISTS "Liquidation_appointmentId_idx";

-- If you still get errors, run the diagnostic below to find the constraint name,
-- then drop it manually:
--   SELECT constraint_name, constraint_type FROM information_schema.table_constraints
--   WHERE table_name = 'Liquidation';

-- 3. New partial unique index for multi-concept rows (itemIndex IS NOT NULL)
--    Prevents duplicating the same line-item concept for the same appointment + doctor.
CREATE UNIQUE INDEX IF NOT EXISTS "Liquidation_appt_doctor_item_idx"
  ON "Liquidation" ("appointmentId", "doctorId", "itemIndex")
  WHERE "appointmentId" IS NOT NULL AND "itemIndex" IS NOT NULL;

-- 4. Partial unique index for single-concept rows (itemIndex IS NULL = old behavior)
--    Preserves the original constraint for appointments that still generate one row.
CREATE UNIQUE INDEX IF NOT EXISTS "Liquidation_appt_doctor_null_idx"
  ON "Liquidation" ("appointmentId", "doctorId")
  WHERE "appointmentId" IS NOT NULL AND "itemIndex" IS NULL;

-- Verification
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'Liquidation'
  AND column_name = 'itemIndex';
