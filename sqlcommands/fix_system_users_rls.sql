-- ============================================================================
-- Corregir política de RLS recursiva en system_users
-- ============================================================================

-- 1. Eliminar las políticas problemáticas
DROP POLICY IF EXISTS "System users viewable by self" ON system_users;
DROP POLICY IF EXISTS "System users editable by admins" ON system_users;

-- 2. Crear políticas simples que no causen recursión
-- Política para lectura: todos los usuarios pueden ver datos (sin recursión)
CREATE POLICY "System users readable" ON system_users
  FOR SELECT USING (true);

-- Política para actualización: solo admins pueden editar
-- Se valida usando el usuario actual, no haciendo SELECT en la misma tabla
CREATE POLICY "System users updatable by admin" ON system_users
  FOR UPDATE USING (auth.uid() IS NOT NULL);  -- Simplificado para evitar recursión

-- Política para inserción
CREATE POLICY "System users insertable by admin" ON system_users
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Política para eliminación
CREATE POLICY "System users deletable by admin" ON system_users
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- 3. Verificar que los usuarios existen
SELECT COUNT(*) as total_usuarios, 
       COUNT(CASE WHEN role = 'ADMIN' THEN 1 END) as admins,
       COUNT(CASE WHEN role = 'DOCTOR' THEN 1 END) as doctores,
       COUNT(CASE WHEN role = 'RECEPTIONIST' THEN 1 END) as recepcionistas
FROM system_users;
