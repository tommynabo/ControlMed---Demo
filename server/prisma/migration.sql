-- Migration: Add missing columns to Patient table
-- Run this against your Supabase PostgreSQL database

-- Add prescriptions column (stores JSON array of prescription strings)
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "prescriptions" TEXT;

-- Add medicalHistory column (stores JSON array of medical history strings)
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "medicalHistory" TEXT;
