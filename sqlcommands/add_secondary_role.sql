-- ============================================================================
-- MIGRACIÓN: Añadir campo de rol secundario a usuarios
-- Ejecutar en Supabase SQL Editor
-- ============================================================================

-- Rol secundario (ej: un ADMIN que también actúa como DOCTOR)
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "secondaryRole" VARCHAR(50) DEFAULT NULL;

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'User'
  AND column_name = 'secondaryRole'
  AND table_schema = 'public';
