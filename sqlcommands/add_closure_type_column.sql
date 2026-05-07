-- Migration: Add closure_type to agenda_closures
-- Allows partial closures: 'full_day' | 'morning_only' | 'afternoon_only'
-- Run this in Supabase SQL Editor

ALTER TABLE agenda_closures 
  ADD COLUMN IF NOT EXISTS closure_type TEXT NOT NULL DEFAULT 'full_day';

-- Verify
SELECT id, closure_date, doctor_id, closure_type, reason 
FROM agenda_closures 
ORDER BY closure_date DESC 
LIMIT 10;
