-- Migration: add manuallyEdited flag to Liquidation
-- Run this once in the Supabase SQL Editor (dashboard → SQL Editor → New query)
--
-- Purpose: marks liquidation rows that have been manually corrected by the admin.
-- Payment-processing paths and ensureLiquidation() will skip overwriting financial
-- fields (labCost, commissionRate, grossAmount, baseAmount, finalAmount) on any row
-- where manuallyEdited = TRUE, so manual corrections are never lost.

ALTER TABLE "Liquidation"
  ADD COLUMN IF NOT EXISTS "manuallyEdited" BOOLEAN NOT NULL DEFAULT FALSE;

-- Optional: index for queries that filter on this flag
CREATE INDEX IF NOT EXISTS idx_liquidation_manually_edited
  ON "Liquidation" ("manuallyEdited")
  WHERE "manuallyEdited" = TRUE;
