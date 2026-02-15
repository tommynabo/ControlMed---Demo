-- =============================================================================
-- NUEVAS TABLAS PARA CONFIGURACIÓN DEL SISTEMA
-- CHC Clinica Dental - Sistema de Gestión
-- =============================================================================

-- 1. TABLA: Información Básica de la Clínica
CREATE TABLE IF NOT EXISTS clinic_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  web_url VARCHAR(255),
  country VARCHAR(100) DEFAULT 'España',
  opening_time TIME DEFAULT '08:00:00',
  closing_time TIME DEFAULT '20:00:00',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. TABLA: Dirección de Clínica
CREATE TABLE IF NOT EXISTS clinic_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES clinic_info(id) ON DELETE CASCADE,
  address_type VARCHAR(50) NOT NULL, -- 'CLINIC', 'BILLING', 'MAIN'
  street VARCHAR(255) NOT NULL,
  street_number VARCHAR(20),
  postal_code VARCHAR(10),
  city VARCHAR(100),
  province VARCHAR(100),
  country VARCHAR(100) DEFAULT 'España',
  is_main_address BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. TABLA: Información de Facturación
CREATE TABLE IF NOT EXISTS clinic_billing_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES clinic_info(id) ON DELETE CASCADE,
  company_name VARCHAR(255) NOT NULL, -- Razón social
  company_type VARCHAR(50), -- 'Persona Juridica', 'Persona Fisica'
  tax_id VARCHAR(20), -- CIF/NIF
  bank_account VARCHAR(50), -- IBAN
  iae_epigraph VARCHAR(100), -- Epígrafe IAE
  responsible_name VARCHAR(255), -- Responsable
  responsible_email VARCHAR(255),
  responsible_phone VARCHAR(20),
  invoice_series VARCHAR(50), -- Serie de facturación
  registration_info TEXT, -- Información registral
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. TABLA: Horarios de Doctores
CREATE TABLE IF NOT EXISTS doctor_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  doctor_name VARCHAR(255) NOT NULL,
  monday BOOLEAN DEFAULT TRUE,
  tuesday BOOLEAN DEFAULT TRUE,
  wednesday BOOLEAN DEFAULT TRUE,
  thursday BOOLEAN DEFAULT TRUE,
  friday BOOLEAN DEFAULT TRUE,
  saturday BOOLEAN DEFAULT FALSE,
  sunday BOOLEAN DEFAULT FALSE,
  morning_start TIME DEFAULT '09:00:00',
  morning_end TIME DEFAULT '13:00:00',
  afternoon_start TIME DEFAULT '16:00:00',
  afternoon_end TIME DEFAULT '20:00:00',
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. TABLA: Duración Estándar de Servicios por Especialidad
CREATE TABLE IF NOT EXISTS service_durations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  specialty VARCHAR(255) NOT NULL,
  duration_min INTEGER NOT NULL DEFAULT 30, -- en minutos
  duration_max INTEGER, -- máximo en minutos
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(specialty)
);

-- 6. TABLA: Períodos de Vacaciones
CREATE TABLE IF NOT EXISTS vacations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  doctor_name VARCHAR(255) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason VARCHAR(255),
  is_approved BOOLEAN DEFAULT FALSE,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. TABLA: Usuarios del Sistema (complemento a auth.users)
CREATE TABLE IF NOT EXISTS system_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL UNIQUE,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL, -- 'ADMIN', 'DOCTOR', 'RECEPTIONIST', 'ASSISTANT'
  specialization VARCHAR(255), -- Para doctores
  phone VARCHAR(20),
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMP WITH TIME ZONE,
  document_id VARCHAR(50), -- DNI/NIF
  document_type VARCHAR(20), -- 'DNI', 'NIE', 'CIF'
  birth_date DATE,
  address TEXT,
  city VARCHAR(100),
  postal_code VARCHAR(10),
  province VARCHAR(100),
  country VARCHAR(100) DEFAULT 'España',
  insurance_number VARCHAR(50), -- Número de seguridad social
  insurance_group VARCHAR(50), -- Grupo de cotización
  professional_category VARCHAR(255), -- Categoría profesional
  bank_account VARCHAR(50),
  mutual VARCHAR(255), -- Mutua
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. TABLA: Auditoría de Acceso al Sistema
CREATE TABLE IF NOT EXISTS system_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email VARCHAR(255),
  action VARCHAR(255) NOT NULL, -- LOGIN, LOGOUT, CREATE, UPDATE, DELETE
  resource_type VARCHAR(100), -- patients, appointments, etc
  resource_id VARCHAR(255),
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. TABLA: Configuraciones Generales
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(255) NOT NULL UNIQUE,
  value TEXT,
  data_type VARCHAR(50), -- 'string', 'integer', 'boolean', 'json'
  description TEXT,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. TABLA: Especialidades y Configuración
CREATE TABLE IF NOT EXISTS specialties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  color VARCHAR(7), -- Color hex para UI
  icon VARCHAR(50),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- INDEXES PARA OPTIMIZACIÓN
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_doctor_schedules_doctor_id ON doctor_schedules(doctor_id);
CREATE INDEX IF NOT EXISTS idx_doctor_schedules_active ON doctor_schedules(is_active);
CREATE INDEX IF NOT EXISTS idx_vacations_doctor_id ON vacations(doctor_id);
CREATE INDEX IF NOT EXISTS idx_vacations_dates ON vacations(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_system_users_role ON system_users(role);
CREATE INDEX IF NOT EXISTS idx_system_users_active ON system_users(is_active);
CREATE INDEX IF NOT EXISTS idx_system_audit_log_user_id ON system_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_system_audit_log_created ON system_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(key);
CREATE INDEX IF NOT EXISTS idx_service_durations_active ON service_durations(is_active);
CREATE INDEX IF NOT EXISTS idx_clinic_addresses_type ON clinic_addresses(address_type);

-- =============================================================================
-- POLÍTICAS DE RLS (ROW LEVEL SECURITY)
-- =============================================================================

-- Habilitar RLS en nuevas tablas
ALTER TABLE clinic_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_billing_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_durations ENABLE ROW LEVEL SECURITY;
ALTER TABLE vacations ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE specialties ENABLE ROW LEVEL SECURITY;

-- Políticas para clinic_info (todos pueden ver, solo ADMINs pueden editar)
CREATE POLICY "Clinic info readable by all" ON clinic_info
  FOR SELECT USING (true);

CREATE POLICY "Clinic info editable by admins" ON clinic_info
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM system_users 
      WHERE system_users.id = auth.uid() 
      AND system_users.role = 'ADMIN'
    )
  );

-- Políticas para doctor_schedules (ADMINS y el doctor pueden ver/editar)
CREATE POLICY "Doctor schedules viewable" ON doctor_schedules
  FOR SELECT USING (
    doctor_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM system_users 
      WHERE system_users.id = auth.uid() 
      AND system_users.role = 'ADMIN'
    )
  );

CREATE POLICY "Doctor schedules editable" ON doctor_schedules
  FOR UPDATE USING (
    doctor_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM system_users 
      WHERE system_users.id = auth.uid() 
      AND system_users.role = 'ADMIN'
    )
  );

-- Políticas para vacations
CREATE POLICY "Vacations viewable" ON vacations
  FOR SELECT USING (
    doctor_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM system_users 
      WHERE system_users.id = auth.uid() 
      AND system_users.role = 'ADMIN'
    )
  );

-- Políticas para system_users (ADMINS pueden editar, usuarios ven su propio perfil)
CREATE POLICY "System users viewable by self" ON system_users
  FOR SELECT USING (
    id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM system_users 
      WHERE system_users.id = auth.uid() 
      AND system_users.role = 'ADMIN'
    )
  );

CREATE POLICY "System users editable by admins" ON system_users
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM system_users 
      WHERE system_users.id = auth.uid() 
      AND system_users.role = 'ADMIN'
    )
  );

-- Políticas para service_durations (todos leen, ADMINS editan)
CREATE POLICY "Service durations readable" ON service_durations
  FOR SELECT USING (true);

CREATE POLICY "Service durations editable by admins" ON service_durations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM system_users 
      WHERE system_users.id = auth.uid() 
      AND system_users.role = 'ADMIN'
    )
  );

-- =============================================================================
-- DATOS INICIALES
-- =============================================================================

-- Insertar información de CHC Clinica Dental
INSERT INTO clinic_info (name, email, phone, web_url, country, opening_time, closing_time)
VALUES (
  'CHC Clinica Dental',
  'Admin@chcclinicadental.com',
  '615049704',
  'www.chcclinicadental.com',
  'España',
  '09:00:00',
  '20:00:00'
) ON CONFLICT DO NOTHING;

-- Insertar dirección de la clínica
INSERT INTO clinic_addresses (clinic_id, address_type, street, street_number, postal_code, city, province, country, is_main_address)
SELECT 
  id,
  'CLINIC',
  'Carrer De La Foneria',
  '24',
  '08038',
  'Barcelona',
  'Barcelona',
  'España',
  TRUE
FROM clinic_info 
WHERE name = 'CHC Clinica Dental'
ON CONFLICT DO NOTHING;

-- Insertar información de facturación
INSERT INTO clinic_billing_info (clinic_id, company_name, company_type, tax_id, bank_account, responsible_name, responsible_email, responsible_phone)
SELECT 
  id,
  'CHCMEDIC SL',
  'Persona Juridica',
  'B75759746',
  'ES21003014722201023555',
  'Kevin Chrabieh',
  'Admin@chcclinicadental.com',
  '615049704'
FROM clinic_info 
WHERE name = 'CHC Clinica Dental'
ON CONFLICT DO NOTHING;

-- Insertar especialidades tipo
INSERT INTO specialties (name, description, color, icon) VALUES
  ('Odontología', 'Tratamientos generales dentales', '#3b638e', 'tooth'),
  ('Periodoncia', 'Tratamiento de encías', '#8b5a8f', 'periodontics'),
  ('Ortodoncia', 'Corrección de dientes', '#4a7ba7', 'brackets'),
  ('Cirugía Oral', 'Cirugía dental y maxilofacial', '#c44569', 'scalpel'),
  ('Endodoncia', 'Tratamiento de raíz', '#6b8e23', 'root'),
  ('Odontopediatría', 'Odontología infantil', '#ff69b4', 'child'),
  ('Estética Dental', 'Tratamientos estéticos', '#ffd700', 'sparkles')
ON CONFLICT (name) DO NOTHING;

-- Insertar duraciones estándar de servicios
INSERT INTO service_durations (specialty, duration_min, duration_max, description) VALUES
  ('Odontología', 45, 60, 'Consulta general y tratamientos básicos'),
  ('Periodoncia', 60, 90, 'Tratamiento de encías'),
  ('Ortodoncia', 45, 60, 'Control y ajustes de ortodoncia'),
  ('Cirugía Oral', 90, 120, 'Extracciones y cirugía dental'),
  ('Endodoncia', 90, 120, 'Tratamiento de conductos'),
  ('Odontopediatría', 30, 45, 'Citas pediátricas'),
  ('Estética Dental', 60, 90, 'Blanqueamiento y tratamientos estéticos')
ON CONFLICT (specialty) DO NOTHING;

-- Insertar configuraciones generales del sistema
INSERT INTO system_settings (key, value, data_type, description) VALUES
  ('app_name', 'MediCore', 'string', 'Nombre de la aplicación'),
  ('default_language', 'es', 'string', 'Idioma por defecto'),
  ('timezone', 'Europe/Madrid', 'string', 'Zona horaria del sistema'),
  ('min_appointment_duration', '15', 'integer', 'Duración mínima de cita en minutos'),
  ('appointment_reminder_hours', '24', 'integer', 'Horas antes de cita para recordatorio'),
  ('max_patients_per_day', '50', 'integer', 'Máximo de pacientes por día'),
  ('currency', 'EUR', 'string', 'Moneda de facturación'),
  ('tax_rate', '21', 'integer', 'Porcentaje de IVA'),
  ('enable_whatsapp', 'true', 'boolean', 'Activar integraciones de WhatsApp'),
  ('enable_email_notifications', 'true', 'boolean', 'Activar notificaciones por email')
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- COMENTARIOS DE TABLAS
-- =============================================================================

COMMENT ON TABLE clinic_info IS 'Información básica de la clínica: nombre, contacto, horarios principales';
COMMENT ON TABLE clinic_addresses IS 'Direcciones de la clínica (clínica, facturación, etc)';
COMMENT ON TABLE clinic_billing_info IS 'Información de facturación legal de la clínica';
COMMENT ON TABLE doctor_schedules IS 'Horarios de trabajo de los doctores: días laborales y turnos';
COMMENT ON TABLE service_durations IS 'Duración estándar de servicios por especialidad';
COMMENT ON TABLE vacations IS 'Períodos de vacaciones y ausencias de doctores';
COMMENT ON TABLE system_users IS 'Información extendida de usuarios del sistema';
COMMENT ON TABLE system_audit_log IS 'Log de auditoría de acciones en el sistema';
COMMENT ON TABLE system_settings IS 'Configuraciones generales del sistema';
COMMENT ON TABLE specialties IS 'Especialidades médico-dentales disponibles en la clínica';

-- =============================================================================
-- FUNCIONES ÚTILES
-- =============================================================================

-- Función para actualizar timestamp de updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger a todas las tablas con updated_at
CREATE TRIGGER update_clinic_info_updated_at BEFORE UPDATE ON clinic_info
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clinic_addresses_updated_at BEFORE UPDATE ON clinic_addresses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clinic_billing_info_updated_at BEFORE UPDATE ON clinic_billing_info
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_doctor_schedules_updated_at BEFORE UPDATE ON doctor_schedules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_service_durations_updated_at BEFORE UPDATE ON service_durations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vacations_updated_at BEFORE UPDATE ON vacations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_users_updated_at BEFORE UPDATE ON system_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON system_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_specialties_updated_at BEFORE UPDATE ON specialties
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- FIN DEL SCRIPT SQL
-- =============================================================================
