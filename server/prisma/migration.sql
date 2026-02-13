-- Migration: Add missing columns
-- Run this against your Supabase PostgreSQL database

-- Patient table columns
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "prescriptions" TEXT;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "medicalHistory" TEXT;

-- Appointment table: store treatment name as text (treatmentId FK is optional)
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "treatmentName" TEXT;
