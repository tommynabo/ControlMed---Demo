-- Safety migration: ensure AUXILIAR and RECEPTION enum values exist in PostgreSQL
-- Run this in the Supabase SQL editor if user role updates are failing.
-- This is needed if the Prisma migration that added AUXILIAR was never applied to the DB.

-- Add missing enum values (IF NOT EXISTS prevents errors if they already exist)
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'AUXILIAR';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'RECEPTION';

-- Verification: list all values in the Role enum
SELECT enumlabel
FROM pg_enum
JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
WHERE pg_type.typname = 'Role'
ORDER BY enumlabel;
