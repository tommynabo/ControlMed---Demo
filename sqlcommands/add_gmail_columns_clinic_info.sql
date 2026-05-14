-- ============================================================================
-- MIGRACIÓN: Añadir columnas Gmail a clinic_info
-- ============================================================================
-- Propósito: El servicio gmailService.js lee y escribe gmail_refresh_token y
--            gmail_connected_email en la tabla clinic_info. Estas columnas no
--            se incluyeron en la migración original (supabase_new_config_tables.sql),
--            por lo que todo el flujo OAuth fallaba silenciosamente.
--
-- ⚠️  Ejecutar en: Supabase → SQL Editor (proyecto gnnacijqglcqonholpwt)
-- ✅  Seguro: usa ADD COLUMN IF NOT EXISTS — idempotente.
-- ============================================================================

ALTER TABLE clinic_info
  ADD COLUMN IF NOT EXISTS gmail_refresh_token  TEXT,
  ADD COLUMN IF NOT EXISTS gmail_connected_email TEXT;

-- Verificación: debería mostrar ambas columnas con data_type = 'text'
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'clinic_info'
  AND column_name IN ('gmail_refresh_token', 'gmail_connected_email')
ORDER BY column_name;
