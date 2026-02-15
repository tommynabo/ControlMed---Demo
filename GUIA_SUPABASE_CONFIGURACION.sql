-- =============================================================================
-- GUÍA DE CONFIGURACIÓN EN SUPABASE
-- CHC Clinica Dental - MediCore
-- =============================================================================

-- =============================================================================
-- PASO 1: VERIFICACIÓN DE IDS DE PACIENTES Y HISTORIALES
-- =============================================================================

/*
 * IMPORTANTE: Los IDs de los pacientes (IDCONTACTO) en el CSV de historiales.csv
 * deben coincidir con los IDs en la tabla patients de la base de datos.
 * 
 * Estructura de datos:
 * - IDCONTACTO (ej: 35021367) = ID único del paciente/contacto
 * - NUM (ej: 19) = Número de historial secuencial
 * - CONTACTO = Nombre del paciente
 * 
 * El sistema debe mantener IDCONTACTO como el identificador principal
 * y NUM como un número secuencial para referencia interna.
 */

-- Verificar que todos los IDCONTACTO en historiales existen en pacientes:
SELECT COUNT(DISTINCT h.IDCONTACTO) as historiales_unicos,
       COUNT(DISTINCT p.id) as pacientes_en_tabla
FROM (
  -- Aquí va la información del CSV de historiales
  -- Reemplazar con SELECT real cuando esté importado
) h
LEFT JOIN patients p ON h.IDCONTACTO = p.id;

-- =============================================================================
-- PASO 2: ACTUALIZAR TABLA PATIENTS CON INFORMACIÓN DEL CSV
-- =============================================================================

/*
 * Las siguientes columnas del CSV deben mapearse a la tabla patients:
 * 
 * CSV Column          -> patients column
 * ==========================================
 * IDCONTACTO          -> id (utilizar como UUID o convertir a string)
 * NOMBRE              -> first_name
 * APELLIDOS           -> last_name
 * SEXO                -> gender
 * F. NACIMIENTO       -> birth_date
 * TELF. MOVIL         -> phone
 * TELF. FIJO          -> secondary_phone
 * EMAIL               -> email
 * DOMICILIO           -> address
 * CP                  -> postal_code
 * POBLACION           -> city
 * PROVINCIA           -> province
 * PAIS                -> country
 * DNI                 -> document_id
 * ESTADO DINAMICO     -> status (Activo/Inactivo)
 * PATOLOGÍA           -> medical_history (condiciones médicas)
 * NUM CUENTA          -> bank_account
 * MUTUA               -> insurance_company
 * NOTAS               -> notes
 */

-- Verificar estructura actual de patients
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'patients'
ORDER BY ordinal_position;

-- =============================================================================
-- PASO 3: CREAR TABLA DE MAPEO PARA HISTORIALES
-- =============================================================================

/*
 * Esta tabla ayuda a rastrear qué IDCONTACTO corresponde a qué patient_id en la BD
 */

CREATE TABLE IF NOT EXISTS patient_id_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  csv_idcontacto VARCHAR(50) NOT NULL,
  csv_numero_historial INTEGER,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  patient_name VARCHAR(255),
  medical_record_number VARCHAR(50), -- NUM del CSV
  is_verified BOOLEAN DEFAULT FALSE,
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(csv_idcontacto)
);

-- =============================================================================
-- PASO 4: ACTUALIZAR TABLA CLINIC_INFO CON DATOS COMPLETOS
-- =============================================================================

-- Actualizar información ya insertada
UPDATE clinic_info 
SET 
  opening_time = '09:00:00',
  closing_time = '20:00:00'
WHERE name = 'CHC Clinica Dental';

-- Verificar los datos cargados
SELECT * FROM clinic_info WHERE name = 'CHC Clinica Dental';

-- Verificar información de facturación
SELECT * FROM clinic_billing_info 
WHERE EXISTS (
  SELECT 1 FROM clinic_info 
  WHERE clinic_info.id = clinic_billing_info.clinic_id 
  AND clinic_info.name = 'CHC Clinica Dental'
);

-- Verificar dirección
SELECT * FROM clinic_addresses
WHERE EXISTS (
  SELECT 1 FROM clinic_info 
  WHERE clinic_info.id = clinic_addresses.clinic_id 
  AND clinic_info.name = 'CHC Clinica Dental'
);

-- =============================================================================
-- PASO 5: CREAR USUARIOS EN SUPABASE (VÍA ADMIN API O PANEL)
-- =============================================================================

/*
 * IMPORTANTE: Los usuarios deben crearse primero en auth.users (tabla de autenticación)
 * 
 * Métodos para crear usuarios:
 * 
 * 1. Panel Admin de Supabase:
 *    - Ir a Authentication -> Users
 *    - Click "Invite user"
 *    - Ingresar email
 *    - El usuario recibirá enlace de invitación
 * 
 * 2. Supabase Admin API (desde backend):
 *    const { data, error } = await supabase.auth.admin.createUser({
 *      email: 'usuario@example.com',
 *      password: 'temporal_password',
 *      email_confirm: true
 *    })
 * 
 * 3. Mediante Edge Function personalizada
 * 
 * Después de crear en auth.users, insertar en system_users con:
 *    INSERT INTO system_users (id, email, full_name, role, ...)
 *    VALUES (uuid_del_auth_user, 'email@example.com', 'Nombre', 'DOCTOR', ...)
 */

-- Script para obtener los UUIDs de auth.users creados
SELECT id, email, created_at 
FROM auth.users
WHERE email IN (
  'kevinchrabieh@gmail.com',
  'admin@chcclinicadental.com',
  'pablorooblanco@gmail.com',
  'almudena.deana.81@gmail.com',
  'blati98172023@hotmail.com',
  'castaycaroline@gmail.com',
  'alvarobabianon@uic.es',
  'elissaeid@uic.es',
  'letmanmon@gmail.com',
  'alisonGUADAMUDALAY@hotmail.com',
  'CLAUDIAVALENTINA30@GMAIL.COM',
  'info@echalemarketing.es',
  'Velasconerea98@gmail.com',
  'tomasnivraone@gmail.com'
)
ORDER BY email;

-- =============================================================================
-- PASO 6: ACTUALIZAR HORARIOS DE DOCTORES
-- =============================================================================

/*
 * Los horarios creados por defecto son:
 * - Lunes a Viernes: 09:00-13:00 (mañana), 16:00-20:00 (tarde)
 * - Sábado y Domingo: No laborables
 * 
 * Adjustar según necesidades reales
 */

-- Ver horarios actuales
SELECT doctor_name, 
       CASE WHEN monday THEN 'Lunes' END ||', ' ||
       CASE WHEN tuesday THEN 'Martes' END ||', ' ||
       CASE WHEN wednesday THEN 'Miércoles' END ||', ' ||
       CASE WHEN thursday THEN 'Jueves' END ||', ' ||
       CASE WHEN friday THEN 'Viernes' END ||', ' ||
       CASE WHEN saturday THEN 'Sábado' END ||', ' ||
       CASE WHEN sunday THEN 'Domingo' END as dias_laborales,
       morning_start, morning_end, afternoon_start, afternoon_end
FROM doctor_schedules
ORDER BY doctor_name;

-- Ajustar horario específico si es necesario (EJEMPLO)
UPDATE doctor_schedules
SET 
  morning_start = '08:30:00',
  afternoon_end = '20:30:00'
WHERE doctor_name = 'Dr. Chrabieh';

-- =============================================================================
-- PASO 7: INSERTAR ESPECIALIDADES FALTANTES DEL CSV
-- =============================================================================

-- Las especialidades del CSV:
-- 'Odontología', 'PERIODONCIA', 'ODP', 'ORTODONCIA'

-- Verificar especialidades existentes
SELECT name FROM specialties ORDER BY name;

-- Agregar si faltan
INSERT INTO specialties (name, description, color, icon) VALUES
  ('Periodoncia', 'Tratamiento de encías avanzado', '#8b5a8f', 'dental'),
  ('ODP', 'Odontología Preventiva', '#3b638e', 'shield')
ON CONFLICT (name) DO NOTHING;

-- =============================================================================
-- PASO 8: CONFIGURAR DURACIONES DE SERVICIOS SEGÚN USO REAL
-- =============================================================================

-- Ver duraciones configuradas
SELECT specialty, duration_min, duration_max, description
FROM service_durations
ORDER BY specialty;

-- Ajustar si es necesario basado en datos reales de citas
UPDATE service_durations
SET duration_min = 30, duration_max = 45
WHERE specialty = 'Odontología';

-- =============================================================================
-- PASO 9: CARGAR INFORMACIÓN DE VACACIONES HISTÓRICAS
-- =============================================================================

/*
 * Si existen vacaciones ya registradas, insertar manualmente:
 * 
 * INSERT INTO vacations (doctor_id, doctor_name, start_date, end_date, reason, is_approved)
 * VALUES (uuid_doctor, 'Dr. Nombre', '2026-01-01', '2026-01-15', 'Vacaciones anuales', true);
 */

-- =============================================================================
-- PASO 10: CONFIGURAR POLÍTICAS DE RLS
-- =============================================================================

/*
 * Las políticas de RLS ya están creadas en el script principal.
 * Verificar que estén habilitadas:
 */

SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename IN (
  'clinic_info', 'doctor_schedules', 'service_durations',
  'vacations', 'system_users', 'system_settings'
);

-- Las políticas deben estar activas (rowsecurity = true)

-- =============================================================================
-- PASO 11: CREAR TRIGGERS Y FUNCIONES
-- =============================================================================

/*
 * Los triggers para actualizar updated_at deben estar creados.
 * Verificar:
 */

SELECT trigger_schema, trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table;

-- =============================================================================
-- PASO 12: PRUEBAS DE FUNCIONAMIENTO
-- =============================================================================

-- Test 1: Verificar que clinic_info está accesible
SELECT name, email, phone, opening_time, closing_time 
FROM clinic_info;

-- Test 2: Verificar horarios de doctores
SELECT doctor_name, is_active, 
       CONCAT(morning_start, '-', morning_end) as turno_manana,
       CONCAT(afternoon_start, '-', afternoon_end) as turno_tarde
FROM doctor_schedules 
WHERE is_active = true
LIMIT 5;

-- Test 3: Verificar duraciones de servicios
SELECT specialty, duration_min, is_active 
FROM service_durations
ORDER BY specialty;

-- Test 4: Verificar usuarios del sistema
SELECT email, full_name, role, is_active 
FROM system_users
WHERE is_active = true
ORDER BY role, full_name;

-- Test 5: Verificar especialidades
SELECT name, color
FROM specialties
WHERE is_active = true
ORDER BY name;

-- =============================================================================
-- NOTAS FINALES
-- =============================================================================

/*
 * 1. SINCRONIZACIÓN DE CAMBIOS:
 *    Cuando se actualice clinic_info o doctor_schedules en Supabase,
 *    los cambios se reflejarán automáticamente en la aplicación
 *    (requiere que el frontend tenga realtime listeners activos)
 * 
 * 2. AUDITORÍA:
 *    Todos los cambios en la configuración se registran en system_audit_log
 *    para cumplimiento normativo.
 * 
 * 3. SEGURIDAD:
 *    - Las contraseñas nunca se almacenan en texto plano
 *    - Las políticas de RLS restringen acceso según rol
 *    - La auditoría registra quién cambió qué y cuándo
 * 
 * 4. BACKUP:
 *    Realizar backups regulares de Supabase, especialmente antes
 *    de cambios masivos en la configuración.
 * 
 * 5. HISTORIAL DE PACIENTES:
 *    Asegurar que los IDCONTACTO del CSV coincidan exactamente
 *    con los IDs en la tabla patients para evitar discrepancias.
 */
