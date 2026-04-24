-- Migration: Add address fields to Patient table
-- Run this once against your Supabase production database

ALTER TABLE "Patient"
  ADD COLUMN IF NOT EXISTS address    TEXT,
  ADD COLUMN IF NOT EXISTS city       TEXT,
  ADD COLUMN IF NOT EXISTS "postalCode" TEXT,
  ADD COLUMN IF NOT EXISTS province   TEXT;
