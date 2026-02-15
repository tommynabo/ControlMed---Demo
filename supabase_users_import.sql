-- =============================================================================
-- SCRIPT DE INSERCIÓN DE USUARIOS DEL SISTEMA
-- CHC Clinica Dental
-- =============================================================================
-- Este script insertará los usuarios del CSV en la tabla system_users
-- NOTA: Requiere que los usuarios existan en auth.users primero
-- =============================================================================

-- Usuarios del sistema con estado "Alta"
INSERT INTO system_users (id, email, full_name, role, is_active, created_at)
VALUES
  -- ADMINISTRADORES
  (uuid_generate_v4(), 'kevinchrabieh@gmail.com', 'Dr. Chrabieh', 'ADMIN', true, NOW()),
  (uuid_generate_v4(), 'almudena.deana.81@gmail.com', 'Almudena', 'ADMIN', true, NOW()),
  (uuid_generate_v4(), 'tomasnivraone@gmail.com', 'Tomas', 'ADMIN', true, NOW()),
  
  -- DOCTORES
  (uuid_generate_v4(), 'pablorooblanco@gmail.com', 'Dr. ROO', 'DOCTOR', true, NOW()),
  (uuid_generate_v4(), 'blati98172023@hotmail.com', 'Dra. Concejero', 'DOCTOR', true, NOW()),
  (uuid_generate_v4(), 'castaycaroline@gmail.com', 'Dra. Castay', 'DOCTOR', true, NOW()),
  (uuid_generate_v4(), 'alvarobabianon@uic.es', 'Alvaro Babiano', 'DOCTOR', true, NOW()),
  (uuid_generate_v4(), 'elissaeid@uic.es', 'Elissa', 'DOCTOR', true, NOW()),
  
  -- RECEPCIONISTAS Y PERSONAL ADMINISTRATIVO
  (uuid_generate_v4(), 'admin@chcclinicadental.com', 'CHC Clinica Dental', 'RECEPTIONIST', true, NOW()),
  (uuid_generate_v4(), 'letmanmon@gmail.com', 'Leticia Rodriguez Silvera', 'RECEPTIONIST', true, NOW()),
  (uuid_generate_v4(), 'alisonGUADAMUDALAY@hotmail.com', 'Alison Betsy', 'RECEPTIONIST', true, NOW()),
  (uuid_generate_v4(), 'CLAUDIAVALENTINA30@GMAIL.COM', 'CLAUDIA', 'RECEPTIONIST', true, NOW()),
  (uuid_generate_v4(), 'info@echalemarketing.es', 'Alejandro', 'RECEPTIONIST', true, NOW()),
  (uuid_generate_v4(), 'Velasconerea98@gmail.com', 'Nerea', 'RECEPTIONIST', true, NOW())
ON CONFLICT DO NOTHING;

-- =============================================================================
-- USUARIOS CON ESTADO "BAJA" (desactivados)
-- =============================================================================

INSERT INTO system_users (id, email, full_name, role, is_active, created_at)
VALUES
  (uuid_generate_v4(), 'kevinchrabieh@uic.es', 'Prueba medico', 'DOCTOR', false, NOW()),
  (uuid_generate_v4(), 'verarfrancisca@gmail.com', 'Francisca', 'RECEPTIONIST', false, NOW()),
  (uuid_generate_v4(), 'vasilikiblathra@uic.es', 'Dra. Blathra', 'DOCTOR', false, NOW()),
  (uuid_generate_v4(), 'molinaramoslaura@gmail.com', 'Laura', 'RECEPTIONIST', false, NOW())
ON CONFLICT DO NOTHING;

-- =============================================================================
-- CONFIGURACIÓN DE HORARIOS PARA DOCTORES ACTIVOS
-- =============================================================================

-- Obtener los UUIDs reales de los usuarios y crear horarios
-- Esto es un ejemplo que debe ajustarse con los UUIDs reales

-- Dr. Chrabieh - Lunes a Viernes
INSERT INTO doctor_schedules (doctor_id, doctor_name, monday, tuesday, wednesday, thursday, friday, saturday, sunday, 
                              morning_start, morning_end, afternoon_start, afternoon_end)
SELECT id, 'Dr. Chrabieh', true, true, true, true, true, false, false, 
       '09:00', '13:00', '16:00', '20:00'
FROM system_users WHERE email = 'kevinchrabieh@gmail.com'
ON CONFLICT DO NOTHING;

-- Dr. ROO (Pablo Roo Blanco)
INSERT INTO doctor_schedules (doctor_id, doctor_name, monday, tuesday, wednesday, thursday, friday, saturday, sunday,
                              morning_start, morning_end, afternoon_start, afternoon_end)
SELECT id, 'Dr. ROO', true, true, true, true, true, false, false,
       '09:00', '13:00', '16:00', '20:00'
FROM system_users WHERE email = 'pablorooblanco@gmail.com'
ON CONFLICT DO NOTHING;

-- Dra. Concejero
INSERT INTO doctor_schedules (doctor_id, doctor_name, monday, tuesday, wednesday, thursday, friday, saturday, sunday,
                              morning_start, morning_end, afternoon_start, afternoon_end)
SELECT id, 'Dra. Concejero', true, true, true, true, true, false, false,
       '09:00', '13:00', '16:00', '20:00'
FROM system_users WHERE email = 'blati98172023@hotmail.com'
ON CONFLICT DO NOTHING;

-- Dra. Castay
INSERT INTO doctor_schedules (doctor_id, doctor_name, monday, tuesday, wednesday, thursday, friday, saturday, sunday,
                              morning_start, morning_end, afternoon_start, afternoon_end)
SELECT id, 'Dra. Castay', true, true, false, true, true, false, false,
       '09:00', '13:00', '16:00', '20:00'
FROM system_users WHERE email = 'castaycaroline@gmail.com'
ON CONFLICT DO NOTHING;

-- Alvaro Babiano
INSERT INTO doctor_schedules (doctor_id, doctor_name, monday, tuesday, wednesday, thursday, friday, saturday, sunday,
                              morning_start, morning_end, afternoon_start, afternoon_end)
SELECT id, 'Alvaro Babiano', true, true, true, false, true, false, false,
       '09:00', '13:00', '16:00', '20:00'
FROM system_users WHERE email = 'alvarobabianon@uic.es'
ON CONFLICT DO NOTHING;

-- Elissa
INSERT INTO doctor_schedules (doctor_id, doctor_name, monday, tuesday, wednesday, thursday, friday, saturday, sunday,
                              morning_start, morning_end, afternoon_start, afternoon_end)
SELECT id, 'Elissa', true, true, true, true, true, false, false,
       '09:00', '13:00', '16:00', '20:00'
FROM system_users WHERE email = 'elissaeid@uic.es'
ON CONFLICT DO NOTHING;

-- =============================================================================
-- NOTA IMPORTANTE SOBRE SEGURIDAD
-- =============================================================================
/*
 * Las contraseñas deben configurarse directamente en Supabase Auth o mediante
 * un proceso seguro. NO se deben incluir contraseñas en este script público.
 * 
 * Pasos recomendados:
 * 1. Crear usuarios en Supabase Auth desde el panel de control
 * 2. Enviar invitaciones por email a los usuarios
 * 3. Los usuarios establecen sus propias contraseñas
 * 4. Este script carga los perfiles de usuario en system_users
 * 
 * Para crear usuarios de forma programática:
 * - Usar la API de Supabase Admin API
 * - Usar supabase_createuser() function si existe
 */

-- =============================================================================
-- VERIFICACIÓN
-- =============================================================================

-- Ver usuarios creados
SELECT COUNT(*) as total_usuarios FROM system_users;
SELECT email, full_name, role, is_active FROM system_users ORDER BY role, full_name;

-- Ver horarios configurados
SELECT doctor_name, 
       CASE WHEN monday THEN 'L' ELSE '-' END ||
       CASE WHEN tuesday THEN 'M' ELSE '-' END ||
       CASE WHEN wednesday THEN 'X' ELSE '-' END ||
       CASE WHEN thursday THEN 'J' ELSE '-' END ||
       CASE WHEN friday THEN 'V' ELSE '-' END ||
       CASE WHEN saturday THEN 'S' ELSE '-' END ||
       CASE WHEN sunday THEN 'D' ELSE '-' END as dias,
       morning_start || '-' || morning_end as turno_manana,
       afternoon_start || '-' || afternoon_end as turno_tarde
FROM doctor_schedules
ORDER BY doctor_name;
