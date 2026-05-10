-- ============================================================================
-- Migration: paymentId UNIQUE constraint on Liquidation
-- ============================================================================
-- Purpose:
--   Guarantees at DB level that a single Payment can never produce two
--   Liquidation rows, even if the application layer fires a duplicate request.
--   The existing @@unique([appointmentId, doctorId]) in Prisma does NOT
--   protect NULL appointmentId rows (SQL NULL ≠ NULL), leaving a gap.
--
-- Safe to run multiple times (uses IF NOT EXISTS guards).
-- ⚠️  Run in Supabase → SQL Editor
-- ============================================================================


-- ─── STEP 1: Add paymentId column if it doesn't already exist ────────────────
ALTER TABLE "Liquidation"
    ADD COLUMN IF NOT EXISTS "paymentId" TEXT;


-- ─── STEP 2: Backfill paymentId from Payment.invoiceId chain ─────────────────
-- Links existing Liquidation rows to their Payment via the shared appointmentId.
-- Only updates rows that are NULL and where exactly ONE matching Payment exists.
UPDATE "Liquidation" l
SET "paymentId" = p.id
FROM "Payment" p
WHERE l."appointmentId" IS NOT NULL
  AND l."appointmentId" = p."appointmentId"
  AND l."paymentId" IS NULL
  AND (
      -- Ensure only one Payment per appointment to avoid ambiguity
      SELECT COUNT(*) FROM "Payment" p2
      WHERE p2."appointmentId" = l."appointmentId"
  ) = 1;


-- ─── STEP 3: Remove any duplicate paymentId values before adding constraint ───
-- Keeps the oldest Liquidation (lowest createdAt) per paymentId; deletes extras.
DELETE FROM "Liquidation"
WHERE id IN (
    SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY "paymentId"
                   ORDER BY "createdAt" ASC
               ) AS rn
        FROM "Liquidation"
        WHERE "paymentId" IS NOT NULL
    ) ranked
    WHERE rn > 1
);


-- ─── STEP 4: Create UNIQUE INDEX (allows multiple NULLs, unique non-NULLs) ───
-- A partial unique index on non-NULL paymentId is the correct SQL pattern.
CREATE UNIQUE INDEX IF NOT EXISTS "Liquidation_paymentId_key"
    ON "Liquidation" ("paymentId")
    WHERE "paymentId" IS NOT NULL;


-- ─── STEP 5: Verify ──────────────────────────────────────────────────────────
SELECT
    COUNT(*)                              AS total_liquidations,
    COUNT("paymentId")                    AS with_paymentId,
    COUNT(*) - COUNT("paymentId")         AS without_paymentId
FROM "Liquidation";
