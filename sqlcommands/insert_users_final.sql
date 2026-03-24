-- ============================================================================
-- Insertar usuarios en system_users (con verificación)
-- ============================================================================

-- 1. Primero, ver cuántos usuarios ya existen
SELECT COUNT(*) as usuarios_actuales FROM system_users;

-- 2. Insertar los 14 usuarios (generando UUIDs)
INSERT INTO system_users (id, email, full_name, role, is_active, phone, city, country)
VALUES
  -- ADMINISTRADORES
  (gen_random_uuid(), 'kevinchrabieh@gmail.com', 'Dr. Kevin Chrabieh', 'ADMIN', true, '615049704', 'Barcelona', 'España'),
  (gen_random_uuid(), 'almudena.deana.81@gmail.com', 'Almudena', 'ADMIN', true, NULL, 'Barcelona', 'España'),
  (gen_random_uuid(), 'tomasnivraone@gmail.com', 'Tomas Navarro', 'ADMIN', true, NULL, 'Barcelona', 'España'),

  -- DOCTORES
  (gen_random_uuid(), 'pablorooblanco@gmail.com', 'Dr. Pablo Roo Blanco', 'DOCTOR', true, NULL, 'Barcelona', 'España'),
  (gen_random_uuid(), 'blati98172023@hotmail.com', 'Dra. Concejero', 'DOCTOR', true, NULL, 'Barcelona', 'España'),
  (gen_random_uuid(), 'castaycaroline@gmail.com', 'Dra. Caroline Castay', 'DOCTOR', true, NULL, 'Barcelona', 'España'),
  (gen_random_uuid(), 'alvarobabianon@uic.es', 'Dr. Alvaro Babiano', 'DOCTOR', true, NULL, 'Barcelona', 'España'),
  (gen_random_uuid(), 'elissaeid@uic.es', 'Dra. Elissa Eid', 'DOCTOR', true, NULL, 'Barcelona', 'España'),

  -- RECEPCIONISTAS
  (gen_random_uuid(), 'admin@chcclinicadental.com', 'CHC Clinica Dental', 'RECEPTIONIST', true, NULL, 'Barcelona', 'España'),
  (gen_random_uuid(), 'letmanmon@gmail.com', 'Leticia Rodriguez Silvera', 'RECEPTIONIST', true, NULL, 'Barcelona', 'España'),
  (gen_random_uuid(), 'alisonGUADAMUDALAY@hotmail.com', 'Alison Betsy', 'RECEPTIONIST', true, NULL, 'Barcelona', 'España'),
  (gen_random_uuid(), 'CLAUDIAVALENTINA30@GMAIL.COM', 'Claudia', 'RECEPTIONIST', true, NULL, 'Barcelona', 'España'),
  (gen_random_uuid(), 'info@echalemarketing.es', 'Alejandro', 'RECEPTIONIST', true, NULL, 'Barcelona', 'España'),
  (gen_random_uuid(), 'Velasconerea98@gmail.com', 'Nerea', 'RECEPTIONIST', true, NULL, 'Barcelona', 'España');

-- 3. Verificar que se insertaron correctamente
SELECT role, COUNT(*) as cantidad 
FROM system_users 
GROUP BY role
ORDER BY role;

-- 4. Mostrar todos los usuarios
SELECT id, email, full_name, role, is_active
FROM system_users 
ORDER BY role, full_name;
