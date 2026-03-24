-- Migration: Create Appointment Table if not exists
-- Date: 2026-01-27

CREATE TABLE IF NOT EXISTS "Appointment" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "date" DATE NOT NULL,
  "time" TEXT NOT NULL,
  "patientId" TEXT NOT NULL REFERENCES "Patient"("id"),
  "doctorId" TEXT REFERENCES "Doctor"("id"),
  "treatmentId" TEXT, 
  "status" TEXT DEFAULT 'Scheduled',
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "notes" TEXT
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS "Appointment_patientId_idx" ON "Appointment"("patientId");
CREATE INDEX IF NOT EXISTS "Appointment_date_idx" ON "Appointment"("date");

-- Fix: Update PatientTreatment status enum/constraint if exists, or just ensure we can use 'PRESUPUESTADO'
-- Ideally we just use TEXT so it's fine.

-- Add missing columns to Patient if needed (wallet was added in previous migration)
