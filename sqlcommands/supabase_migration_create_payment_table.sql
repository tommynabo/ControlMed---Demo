-- Migration: Create Payment Table
-- Date: 2026-01-28
-- Purpose: Wallet/Payment History functionality

CREATE TABLE IF NOT EXISTS "Payment" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "patientId" TEXT NOT NULL REFERENCES "Patient"("id"),
  "budgetId" TEXT,
  "amount" FLOAT NOT NULL,
  "method" TEXT NOT NULL, -- 'cash', 'card', 'wallet', 'transfer', 'ADVANCE_PAYMENT'
  "type" TEXT NOT NULL, -- 'DIRECT_CHARGE' or 'ADVANCE_PAYMENT' or 'INVOICE'
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "invoiceId" TEXT UNIQUE,
  "notes" TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS "Payment_patientId_idx" ON "Payment"("patientId");
CREATE INDEX IF NOT EXISTS "Payment_type_idx" ON "Payment"("type");
