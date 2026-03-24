-- Migration: Add wallet (saldo) column to Patient
-- Date: 2026-01-28

ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "wallet" FLOAT DEFAULT 0.0;
