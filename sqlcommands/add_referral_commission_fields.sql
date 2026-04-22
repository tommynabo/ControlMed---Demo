-- Migration: Add referral commission fields
-- Budget: store which entity referred the patient (visible per-budget)
ALTER TABLE "Budget"
  ADD COLUMN IF NOT EXISTS "referralEntityName" TEXT;

-- Payment: store the split amounts so we have an audit trail
ALTER TABLE "Payment"
  ADD COLUMN IF NOT EXISTS "referralCommission" DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "referralEntityName" TEXT;

-- Liquidation: store base amount (without markup) + referral commission split
ALTER TABLE "Liquidation"
  ADD COLUMN IF NOT EXISTS "baseAmount"         DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "referralCommission" DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "referralEntityName" TEXT;
