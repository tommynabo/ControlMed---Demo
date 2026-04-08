-- ============================================================================
-- MIGRACIÓN: Añadir campo isDoctor a tabla User
-- Fecha: 2026-04-08
-- Descripción: Permite que un usuario (ej. ADMIN) también sea doctor (is_doctor=true)
--              sin cambiar su rol de acceso al CRM.
-- ============================================================================

-- 1. Añadir la columna isDoctor (ya que Prisma la mapea como "isDoctor")
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isDoctor" BOOLEAN NOT NULL DEFAULT false;

-- 2. Backfill: marcar como isDoctor=true a todos los usuarios que ya tienen rol DOCTOR
UPDATE "User" SET "isDoctor" = true WHERE role = 'DOCTOR';

-- 3. (Opcional) Asignar isDoctor=true a Kevin (o cualquier ADMIN que también sea doctor)
--    Sustituye el email real de Kevin:
-- UPDATE "User" SET "isDoctor" = true WHERE email = 'kevin@tuclinica.com';

-- Verificar resultado
-- SELECT id, name, email, role, "isDoctor", "doctorId" FROM "User" ORDER BY role, name;
