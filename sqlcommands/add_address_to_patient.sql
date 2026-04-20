-- Add address field to Patient table to store patient's domicilio/dirección
-- This migration adds missing patient data fields from the import CSV

ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "address" TEXT;

-- Also add city, postalCode, province for complete address information
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "postalCode" TEXT;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "province" TEXT;

-- Verify columns were added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'Patient' AND column_name IN ('address', 'city', 'postalCode', 'province')
ORDER BY ordinal_position;
