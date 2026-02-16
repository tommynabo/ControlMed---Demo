-- ============================================================================
-- Deshabilitar RLS en system_users (tabla de configuración interna)
-- ============================================================================

-- 1. Eliminar TODAS las políticas existentes
DROP POLICY IF EXISTS "System users viewable by self" ON system_users;
DROP POLICY IF EXISTS "System users editable by admins" ON system_users;
DROP POLICY IF EXISTS "System users readable" ON system_users;
DROP POLICY IF EXISTS "System users updatable by admin" ON system_users;
DROP POLICY IF EXISTS "System users insertable by admin" ON system_users;
DROP POLICY IF EXISTS "System users deletable by admin" ON system_users;

-- 2. DESHABILITAR RLS en system_users (es una tabla de configuración interna)
ALTER TABLE system_users DISABLE ROW LEVEL SECURITY;

-- 3. Verificar que la tabla está accesible
SELECT COUNT(*) as total_usuarios FROM system_users;

-- 4. Verificar que se pueden ver los datos
SELECT email, full_name, role FROM system_users ORDER BY role, full_name;
