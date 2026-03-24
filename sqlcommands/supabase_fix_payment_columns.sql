-- Add missing columns to Payment table for transfer/commission support
-- Run this in Supabase SQL Editor

-- Add doctorId column (for doctor commission tracking)
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "doctorId" TEXT;

-- Add sourcePaymentId column (for tracking transfer source)
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "sourcePaymentId" TEXT;

-- Add treatmentId column (for linking payment to specific treatment)
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "treatmentId" TEXT;
