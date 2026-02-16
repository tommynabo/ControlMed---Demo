-- Migration: Sincronizar Usuarios Doctores a Tabla Doctor
-- Date: 2026-02-16
-- Purpose: Importar todos los usuarios con role='DOCTOR' a la tabla Doctor

-- 1. Insert all DOCTOR users from User table into Doctor table (if not already exist)
INSERT INTO "Doctor" (id, name, specialization, "commissionPercentage")
SELECT 
    u.id,
    u.name,
    'Odontólogo' as specialization,  -- Default specialization
    0.0 as "commissionPercentage"
FROM "User" u
WHERE u.role = 'DOCTOR'
  AND u.id NOT IN (SELECT id FROM "Doctor")
ON CONFLICT (id) DO NOTHING;

-- 2. Create or update foreign key linking if needed
-- Already designed with "doctorId" in User table, so User.id can reference Doctor.id

-- 3. Verify import
SELECT 
    COUNT(*) as total_doctors,
    COUNT(DISTINCT u.id) as doctors_from_users
FROM "Doctor" d
LEFT JOIN "User" u ON d.id = u.id AND u.role = 'DOCTOR';

-- Optional: If you want to link specialization from somewhere, run this:
-- UPDATE "Doctor" 
-- SET specialization = 'Especialista' 
-- WHERE specialization = 'Odontólogo' AND id IN (SELECT id FROM "User" WHERE name LIKE '%Especialista%');

-- Verification query - see all doctors now available:
SELECT id, name, specialization FROM "Doctor" ORDER BY name;
