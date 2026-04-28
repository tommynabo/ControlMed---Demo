-- Migration: Create doctor_schedule_overrides table for turnos excepcionales
-- Run this in Supabase SQL editor

CREATE TABLE IF NOT EXISTS "doctor_schedule_overrides" (
    "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "doctor_id"   TEXT NOT NULL REFERENCES "Doctor"("id") ON DELETE CASCADE,
    "date"        DATE NOT NULL,
    "start_time"  TEXT NOT NULL,
    "end_time"    TEXT NOT NULL,
    "notes"       TEXT,
    "created_at"  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schedule_overrides_doctor_date
    ON "doctor_schedule_overrides"("doctor_id", "date");

-- Enable Row Level Security (optional but recommended)
ALTER TABLE "doctor_schedule_overrides" ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to manage overrides
CREATE POLICY "Allow authenticated access to schedule overrides"
    ON "doctor_schedule_overrides"
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
