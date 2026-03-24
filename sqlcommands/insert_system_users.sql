-- ============================================================================
-- Insertar usuarios en la tabla system_users
-- CHC Clinica Dental
-- ============================================================================

INSERT INTO system_users (email, full_name, role, is_active) VALUES
  -- ADMINISTRADORES
  ('kevinchrabieh@gmail.com', 'Dr. Kevin Chrabieh', 'ADMIN', true),
  ('almudena.deana.81@gmail.com', 'Almudena', 'ADMIN', true),
  ('tomasnivraone@gmail.com', 'Tomas Navarro', 'ADMIN', true),

  -- DOCTORES
  ('pablorooblanco@gmail.com', 'Dr. Pablo Roo Blanco', 'DOCTOR', true),
  ('blati98172023@hotmail.com', 'Dra. Concejero', 'DOCTOR', true),
  ('castaycaroline@gmail.com', 'Dra. Caroline Castay', 'DOCTOR', true),
  ('alvarobabianon@uic.es', 'Dr. Alvaro Babiano', 'DOCTOR', true),
  ('elissaeid@uic.es', 'Dra. Elissa Eid', 'DOCTOR', true),

  -- RECEPCIONISTAS
  ('admin@chcclinicadental.com', 'CHC Clinica Dental', 'RECEPTIONIST', true),
  ('letmanmon@gmail.com', 'Leticia Rodriguez Silvera', 'RECEPTIONIST', true),
  ('alisonGUADAMUDALAY@hotmail.com', 'Alison Betsy', 'RECEPTIONIST', true),
  ('CLAUDIAVALENTINA30@GMAIL.COM', 'Claudia', 'RECEPTIONIST', true),
  ('info@echalemarketing.es', 'Alejandro', 'RECEPTIONIST', true),
  ('Velasconerea98@gmail.com', 'Nerea', 'RECEPTIONIST', true)

ON CONFLICT (email) DO NOTHING;

-- Verificar que se insertaron correctamente
SELECT role, COUNT(*) as cantidad 
FROM system_users 
GROUP BY role
ORDER BY role;
