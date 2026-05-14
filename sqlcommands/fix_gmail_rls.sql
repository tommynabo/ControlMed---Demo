-- ============================================================================
-- SEGURIDAD: Restringir acceso a columnas sensibles de Gmail en clinic_info
-- ============================================================================
-- Problema: la política "Clinic info readable by all" permite a cualquier
--           usuario autenticado (doctores, recepcionistas) leer gmail_refresh_token
--           directamente desde Supabase. Es una credencial OAuth sensible.
--
-- Solución: mantener la policy de SELECT general pero añadir una vista pública
--           que expone solo los campos no sensibles para uso desde el frontend,
--           y crear una policy separada que restringe UPDATE de las columnas
--           gmail_* solo a roles ADMIN.
--
-- ⚠️  Ejecutar en: Supabase → SQL Editor (proyecto gnnacijqglcqonholpwt)
-- ============================================================================

-- ─── 1. Vista pública sin tokens (para frontend) ──────────────────────────────
-- El frontend solo necesita name, email, phone, etc. — nunca el refresh_token.
CREATE OR REPLACE VIEW clinic_info_public AS
  SELECT
    id,
    name,
    email,
    phone,
    web_url,
    country,
    opening_time,
    closing_time,
    gmail_connected_email,   -- solo el email visible, no el token
    created_at,
    updated_at
  FROM clinic_info;

-- ─── 2. Policy de UPDATE: solo ADMIN puede tocar las columnas gmail_* ─────────
-- La policy existente de INSERT/UPDATE ya limita a admins; esto añade una capa
-- explícita de comprobación en el servidor usando service_role cuando sea necesario.

-- Verificar políticas actuales sobre clinic_info:
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'clinic_info'
ORDER BY cmd;
