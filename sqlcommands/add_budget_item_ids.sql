-- Migration: add budgetItemIds column to Appointment table
-- This stores a JSON-serialised array of BudgetLineItem IDs linked to the appointment,
-- enabling multi-treatment selection to persist across sessions.
-- The existing budgetItemId (singular) column is kept for backwards compatibility.

ALTER TABLE "Appointment"
  ADD COLUMN IF NOT EXISTS "budgetItemIds" TEXT;
