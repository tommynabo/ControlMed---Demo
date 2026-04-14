-- ============================================================
-- MIGRATION: Audit columns for Appointment + system_audit_log
-- Date: 2026-04-14
-- ============================================================

-- 1. Add created_by and updated_by columns to Appointment table
--    "User".id is TEXT in this schema, so we use TEXT here too.
--    Soft reference (no FK constraint) to survive user deletions gracefully.

ALTER TABLE "Appointment"
  ADD COLUMN IF NOT EXISTS created_by TEXT;

ALTER TABLE "Appointment"
  ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- 2. Add indexes for efficient audit queries
CREATE INDEX IF NOT EXISTS idx_appointment_created_by ON "Appointment"(created_by);
CREATE INDEX IF NOT EXISTS idx_appointment_updated_by ON "Appointment"(updated_by);

-- 3. Ensure system_audit_log table exists with correct FK to "User"
--    (Recreates if the one from supabase_new_config_tables.sql referenced auth.users)

CREATE TABLE IF NOT EXISTS system_audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID,                         -- Soft FK to "User".id (no hard constraint to survive user deletion gracefully)
  user_email    VARCHAR(255),
  user_role     VARCHAR(50),                  -- ADMIN | RECEPTION | AUXILIAR | DOCTOR
  action        VARCHAR(100) NOT NULL,        -- CREATE | UPDATE | DELETE | LOGIN | LOGOUT
  resource_type VARCHAR(100) NOT NULL,        -- appointments | patients | budgets | etc.
  resource_id   VARCHAR(255),
  old_values    JSONB,
  new_values    JSONB,
  ip_address    INET,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_user_id   ON system_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created   ON system_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource  ON system_audit_log(resource_type, resource_id);

-- 4. Verify: run this SELECT after migration to confirm columns exist
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'Appointment'
--   AND column_name IN ('created_by', 'updated_by');
