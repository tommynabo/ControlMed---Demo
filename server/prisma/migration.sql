-- =============================================================
-- COMPREHENSIVE MIGRATION: CRM Medico - Supabase PostgreSQL
-- Run this ONCE against your Supabase SQL Editor
-- All statements use IF NOT EXISTS - safe to re-run
-- =============================================================

-- =====================
-- PATIENT TABLE
-- =====================
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "historyNumber" TEXT UNIQUE;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "firstName" TEXT;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "lastName1" TEXT;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "lastName2" TEXT;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "balance" DOUBLE PRECISION DEFAULT 0.0;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "wallet" DOUBLE PRECISION DEFAULT 0.0;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "allergies" TEXT;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "smoker" BOOLEAN DEFAULT false;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "diseases" TEXT;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "medications" TEXT;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "criticalAlerts" TEXT;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "prescriptions" TEXT;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "medicalHistory" TEXT;

-- =====================
-- APPOINTMENT TABLE
-- =====================
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "duration" INTEGER DEFAULT 60;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "observations" TEXT;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "budgetId" UUID REFERENCES "Budget"("id");
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "budgetItemId" TEXT;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "amount" DOUBLE PRECISION;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "treatmentName" TEXT;

-- =====================
-- BUDGET TABLE
-- =====================
ALTER TABLE "Budget" ADD COLUMN IF NOT EXISTS "title" TEXT;

-- =====================
-- LIQUIDATION TABLE
-- =====================
ALTER TABLE "Liquidation" ADD COLUMN IF NOT EXISTS "treatmentName" TEXT;
ALTER TABLE "Liquidation" ADD COLUMN IF NOT EXISTS "patientName" TEXT;
ALTER TABLE "Liquidation" ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT;

-- =====================
-- INVOICE TABLE
-- =====================
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "concept" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "relatedPaymentId" TEXT UNIQUE;

-- =====================
-- PAYMENT TABLE
-- =====================
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "invoiceId" TEXT UNIQUE;
