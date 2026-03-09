-- ============================================================
-- MIGRACIÓN: Sistema de Roles con 4 niveles
-- Fecha: 2026-03-09
-- ============================================================

-- 1. Actualizar el ENUM de roles para incluir AUXILIAR
-- Postgres no permite ALTER TYPE ADD VALUE dentro de transacciones,
-- así que lo hacemos fuera del bloque DO

-- Verificar si el valor ya existe antes de añadirlo
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'AUXILIAR' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'Role')) THEN
        ALTER TYPE "Role" ADD VALUE 'AUXILIAR';
    END IF;
END$$;

-- 2. Añadir columna gmail a la tabla User (para asociar cuentas Gmail)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "gmail" TEXT;

-- 3. Crear tabla de permisos por rol (referencia)
CREATE TABLE IF NOT EXISTS role_permissions (
    id SERIAL PRIMARY KEY,
    role TEXT NOT NULL,
    permission TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(role, permission)
);

-- 4. Insertar permisos por rol
INSERT INTO role_permissions (role, permission, description) VALUES
    -- ADMIN: acceso total
    ('ADMIN', 'dashboard.view', 'Ver dashboard'),
    ('ADMIN', 'patients.view', 'Ver pacientes'),
    ('ADMIN', 'patients.edit', 'Editar pacientes'),
    ('ADMIN', 'agenda.view', 'Ver agenda'),
    ('ADMIN', 'agenda.edit', 'Editar agenda'),
    ('ADMIN', 'billing.view', 'Ver facturación'),
    ('ADMIN', 'billing.edit', 'Editar facturación'),
    ('ADMIN', 'cashregister.view', 'Ver caja'),
    ('ADMIN', 'cashregister.edit', 'Editar caja'),
    ('ADMIN', 'clinical.view', 'Ver historias clínicas'),
    ('ADMIN', 'clinical.edit', 'Editar historias clínicas'),
    ('ADMIN', 'stock.view', 'Ver stock'),
    ('ADMIN', 'stock.edit', 'Editar stock'),
    ('ADMIN', 'payroll.view', 'Ver nóminas'),
    ('ADMIN', 'payroll.edit', 'Editar nóminas'),
    ('ADMIN', 'ai.view', 'Usar asistente IA'),
    ('ADMIN', 'settings.view', 'Ver configuración'),
    ('ADMIN', 'settings.edit', 'Editar configuración'),
    ('ADMIN', 'users.manage', 'Gestionar usuarios'),

    -- RECEPCION: acceso a cuentas, facturación, agendas y demás (excepto config, nóminas, IA)
    ('RECEPTION', 'dashboard.view', 'Ver dashboard'),
    ('RECEPTION', 'patients.view', 'Ver pacientes'),
    ('RECEPTION', 'patients.edit', 'Editar pacientes'),
    ('RECEPTION', 'agenda.view', 'Ver agenda'),
    ('RECEPTION', 'agenda.edit', 'Editar agenda'),
    ('RECEPTION', 'billing.view', 'Ver facturación'),
    ('RECEPTION', 'billing.edit', 'Editar facturación'),
    ('RECEPTION', 'cashregister.view', 'Ver caja'),
    ('RECEPTION', 'cashregister.edit', 'Editar caja'),
    ('RECEPTION', 'clinical.view', 'Ver historias clínicas'),
    ('RECEPTION', 'stock.view', 'Ver stock'),
    ('RECEPTION', 'stock.edit', 'Editar stock'),

    -- AUXILIAR: agendas (ver y editar) e historias clínicas
    ('AUXILIAR', 'dashboard.view', 'Ver dashboard'),
    ('AUXILIAR', 'patients.view', 'Ver pacientes'),
    ('AUXILIAR', 'patients.edit', 'Editar pacientes'),
    ('AUXILIAR', 'agenda.view', 'Ver agenda'),
    ('AUXILIAR', 'agenda.edit', 'Editar agenda'),
    ('AUXILIAR', 'clinical.view', 'Ver historias clínicas'),
    ('AUXILIAR', 'clinical.edit', 'Editar historias clínicas'),

    -- DOCTOR: ver y editar agendas, ver historias clínicas
    ('DOCTOR', 'dashboard.view', 'Ver dashboard'),
    ('DOCTOR', 'patients.view', 'Ver pacientes'),
    ('DOCTOR', 'agenda.view', 'Ver agenda'),
    ('DOCTOR', 'agenda.edit', 'Editar agenda'),
    ('DOCTOR', 'clinical.view', 'Ver historias clínicas')
ON CONFLICT (role, permission) DO NOTHING;

-- 5. Verificación
SELECT 'Roles disponibles:' AS info;
SELECT enumlabel FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'Role');

SELECT 'Permisos por rol:' AS info;
SELECT role, COUNT(*) as total_permisos FROM role_permissions GROUP BY role ORDER BY role;
