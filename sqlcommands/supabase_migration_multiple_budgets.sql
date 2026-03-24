-- Migration: Add support for multiple budget items per appointment
-- Date: 2026-02-16

-- Add budget_item_ids column to store multiple items as JSON array
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Appointment' AND column_name = 'budget_item_ids') THEN
        ALTER TABLE "Appointment" ADD COLUMN "budget_item_ids" JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- Add budget_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Appointment' AND column_name = 'budgetId') THEN
        ALTER TABLE "Appointment" ADD COLUMN "budgetId" TEXT;
    END IF;
END $$;

-- Add observations column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Appointment' AND column_name = 'observations') THEN
        ALTER TABLE "Appointment" ADD COLUMN "observations" TEXT;
    END IF;
END $$;
