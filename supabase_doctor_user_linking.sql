-- ============================================================================
-- DOCTOR & USER ACCOUNT LINKING FIX
-- ============================================================================
-- Purpose: Ensure every doctor has a corresponding system user account
-- Fixes the issue from audio: "la información de los doctores la tengo yo, pero 
-- lo que hay que hacer es ir creando cuentas a cada doctor para que él pueda abrir"
-- ============================================================================

-- 1. Add user_id column to Doctor table if it doesn't exist
-- This creates a link between Doctor profile and system User account
ALTER TABLE "Doctor" 
ADD COLUMN IF NOT EXISTS user_id UUID UNIQUE REFERENCES "User"(id) ON DELETE SET NULL;

-- 2. Add is_active flag to Doctor table for soft deletion
ALTER TABLE "Doctor"
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 3. Add created_at and updated_at for audit trail
ALTER TABLE "Doctor"
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT now();

-- 4. Add specialization validation - ensure specialization is linked to specialty or deprecated field is clear
-- This helps maintain data integrity after specialization migration
ALTER TABLE "Doctor"
ADD CONSTRAINT check_specialization CHECK (
  specialization IS NOT NULL OR specialtyId IS NOT NULL
);

-- 5. Create an index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_doctor_user_id ON "Doctor"(user_id);

-- 6. Create an index on is_active for filtering active doctors
CREATE INDEX IF NOT EXISTS idx_doctor_is_active ON "Doctor"(is_active);

-- 7. Add doctor_id foreign key to User table if it doesn't exist
-- This was mentioned in schema but let's ensure it's properly set up
-- ALTER TABLE "User" 
-- ADD COLUMN IF NOT EXISTS doctor_id UUID REFERENCES "Doctor"(id) ON DELETE SET NULL;
-- (This already exists in the schema as per Prisma definition)

-- 8. Create a view for active doctors with their user info
CREATE OR REPLACE VIEW active_doctors_with_users AS
SELECT 
  d.id,
  d.name,
  d.specialization,
  d.specialtyId,
  d.commissionPercentage,
  d.user_id,
  u.email,
  u.name as user_name,
  u.role,
  d.is_active
FROM "Doctor" d
LEFT JOIN "User" u ON d.user_id = u.id
WHERE d.is_active = true;

-- 9. Add trigger to ensure doctor schedules are only created for active doctors with user accounts
-- Note: This would require PL/pgSQL, which may not be available in all Supabase setups
-- For now, we rely on application-level validation

-- 10. Create migration script for admins to link existing doctors to users
-- Run this manually after creating user accounts for each doctor:
-- UPDATE "Doctor" 
-- SET user_id = (SELECT id FROM "User" WHERE email = '[doctor_email]' LIMIT 1)
-- WHERE name = '[doctor_name]';

-- 11. Add RLS (Row Level Security) policy to ensure doctors only see their own data
-- This is optional but recommended for multi-tenancy
-- ALTER TABLE "Doctor" ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "doctors_can_select_own_data" ON "Doctor"
-- FOR SELECT USING (user_id = auth.uid() OR auth.role() = 'admin');

-- ============================================================================
-- IMPLEMENTATION CHECKLIST:
-- ============================================================================
-- 1. ✓ Run this SQL migration
-- 2. Create a system user for each doctor (via Settings > Users)
-- 3. Link each doctor to their user account via UPDATE statement#10
-- 4. Ensure Doctor Selection in Agenda only shows doctors with active user accounts
-- 5. Update appointment validation to prevent bookings with inactive doctors
-- 6. Add admin interface to manage doctor-user linking
-- ============================================================================

COMMENT ON COLUMN "Doctor".user_id IS 'References the system user account for this doctor';
COMMENT ON COLUMN "Doctor".is_active IS 'Soft deletion flag - set to false to deactivate doctor without losing history';
