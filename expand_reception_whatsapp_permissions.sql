-- ==============================================================================
-- SCRIPT: Ampliar Permisos de WhatsApp para Recepción
-- Propósito: Permitir CRUD completo a RECEPTION sobre tablas de WhatsApp
-- ==============================================================================

-- 1. Función para verificar si el usuario es RECEPTION o ADMIN
CREATE OR REPLACE FUNCTION is_reception_or_admin() RETURNS BOOLEAN AS $$
DECLARE
  current_role TEXT;
BEGIN
  -- Intentar obtener el rol de system_users (esquema nuevo)
  SELECT role INTO current_role FROM public.system_users WHERE id = auth.uid() LIMIT 1;
  
  -- Si no está en system_users, intentar en la tabla User (esquema anterior/Prisma)
  IF current_role IS NULL THEN
    SELECT role::TEXT INTO current_role FROM public."User" WHERE id = auth.uid()::TEXT LIMIT 1;
  END IF;

  RETURN current_role IN ('ADMIN', 'RECEPTION');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Habilitar RLS y Políticas para WhatsAppTemplate
ALTER TABLE "public"."WhatsAppTemplate" ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas antiguas si existen
DROP POLICY IF EXISTS "WhatsAppTemplate: Public read" ON "public"."WhatsAppTemplate";
DROP POLICY IF EXISTS "WhatsAppTemplate: Admin insert" ON "public"."WhatsAppTemplate";
DROP POLICY IF EXISTS "WhatsAppTemplate: Admin update" ON "public"."WhatsAppTemplate";
DROP POLICY IF EXISTS "WhatsAppTemplate: Admin delete" ON "public"."WhatsAppTemplate";
DROP POLICY IF EXISTS "WhatsAppTemplate: Reception/Admin full access" ON "public"."WhatsAppTemplate";

-- Nueva política de acceso completo para Recepción y Admin
CREATE POLICY "WhatsAppTemplate: Reception/Admin full access" ON "public"."WhatsAppTemplate"
  FOR ALL
  USING (is_reception_or_admin())
  WITH CHECK (is_reception_or_admin());

-- Mantener lectura para otros roles autenticados (según sea necesario)
CREATE POLICY "WhatsAppTemplate: Public read" ON "public"."WhatsAppTemplate"
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 3. Habilitar RLS y Políticas para WhatsAppLog
ALTER TABLE "public"."WhatsAppLog" ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas antiguas si existen
DROP POLICY IF EXISTS "WhatsAppLog: Admin see all" ON "public"."WhatsAppLog";
DROP POLICY IF EXISTS "WhatsAppLog: Admin insert" ON "public"."WhatsAppLog";
DROP POLICY IF EXISTS "WhatsAppLog: Admin update" ON "public"."WhatsAppLog";
DROP POLICY IF EXISTS "WhatsAppLog: Admin delete" ON "public"."WhatsAppLog";
DROP POLICY IF EXISTS "WhatsAppLog: Reception/Admin full access" ON "public"."WhatsAppLog";

-- Nueva política de acceso completo para Recepción y Admin
CREATE POLICY "WhatsAppLog: Reception/Admin full access" ON "public"."WhatsAppLog"
  FOR ALL
  USING (is_reception_or_admin())
  WITH CHECK (is_reception_or_admin());
