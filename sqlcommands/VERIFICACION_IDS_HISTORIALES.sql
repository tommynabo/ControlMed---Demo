-- =============================================================================
-- VERIFICACIÓN Y VALIDACIÓN DE IDS DE PACIENTES E HISTORIALES
-- CHC Clinica Dental - MediCore
-- =============================================================================

-- =============================================================================
-- SECCIÓN 1: ANÁLISIS DE DATOS DEL CSV
-- =============================================================================

/*
 * ESTRUCTURA DE IDS EN LOS CSVs IMPORTADOS:
 * 
 * 1. Archivo: 38e2cb5bf2f1ecab4b9861a51f5377a2_36424_1771171925.csv (CONTACTOS)
 *    - IDCONTACTO: ID único del paciente (ej: 35021367)
 *    - NUM: Número secuencial de historial (ej: 19)
 *    - NOMBRE, APELLIDOS: Datos personales
 *    - Estado: Activo/Baja
 * 
 * 2. Archivo: historiales.csv (REGISTROS MÉDICOS)
 *    - IDCONTACTO: ID del paciente que tiene el historial
 *    - CONTACTO: Nombre del paciente (referencia visual)
 *    - NUM: Número de historial (referencia)
 *    - ESPECIALIDAD: Tipo de consulta
 *    - FECHA, HORA: Cuándo se vio al paciente
 *    - HISTORIA, EVOLUCION: Notas médicas
 * 
 * MAPEO REQUERIDO:
 * El IDCONTACTO del CSV debe convertirse a UUID en la BD y ser la PK
 * de la tabla patients para que los historiales se relacionen correctamente.
 */

-- =============================================================================
-- SECCIÓN 2: QUERY PARA ANALIZAR INTEGRIDAD DE DATOS
-- =============================================================================

/*
 * Las siguientes queries se ejecutarían en Supabase si los CSVs estuvieran importados
 */

-- Query 1: Estadísticas de pacientes en el CSV de contactos
-- SELECT 
--   COUNT(*) as total_registros,
--   COUNT(DISTINCT IDCONTACTO) as pacientes_unicos,
--   COUNT(CASE WHEN ESTADO = 'Activo' THEN 1 END) as activos,
--   COUNT(CASE WHEN ESTADO = 'Baja' THEN 1 END) as inactivos
-- FROM csv_contactos;

-- Query 2: Verificar que cada IDCONTACTO en historiales existe en contactos
-- SELECT 
--   COUNT(DISTINCT h.IDCONTACTO) as historiales_unicos,
--   COUNT(DISTINCT c.IDCONTACTO) as contactos_unicos,
--   COUNT(DISTINCT CASE WHEN c.IDCONTACTO IS NOT NULL THEN h.IDCONTACTO END) as coincidencias
-- FROM csv_historiales h
-- LEFT JOIN csv_contactos c ON h.IDCONTACTO = c.IDCONTACTO;

-- Query 3: Identificar IDCONTACTO sin registros de citas
-- SELECT c.IDCONTACTO, c.NOMBRE, c.APELLIDOS
-- FROM csv_contactos c
-- LEFT JOIN csv_historiales h ON c.IDCONTACTO = h.IDCONTACTO
-- WHERE h.IDCONTACTO IS NULL
-- ORDER BY c.NOMBRE;

-- =============================================================================
-- SECCIÓN 3: TABLA PARA CONTROL DE INTEGRIDAD DE DATOS
-- =============================================================================

CREATE TABLE IF NOT EXISTS data_import_validation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  validation_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Estadísticas de contactos
  csv_total_contactos INTEGER,
  csv_contactos_activos INTEGER,
  csv_contactos_inactivos INTEGER,
  csv_idcontactos_unicos INTEGER,
  
  -- Estadísticas de historiales
  csv_total_historiales INTEGER,
  csv_historiales_unicos INTEGER,
  
  -- Mapeos en BD
  db_total_patients INTEGER,
  db_mapped_patients INTEGER,
  db_unmapped_patients INTEGER,
  
  -- Integridad
  missing_idcontactos_count INTEGER,
  orphan_records_count INTEGER,
  integrity_status VARCHAR(50), -- 'OK', 'WARNING', 'ERROR'
  
  -- Detalles
  notes TEXT,
  performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- SECCIÓN 4: CREAR VISTA PARA ANÁLISIS DE HISTORIAL POR PACIENTE
-- =============================================================================

CREATE OR REPLACE VIEW patient_history_summary AS
SELECT 
  p.id as patient_id,
  p.first_name,
  p.last_name,
  COUNT(cr.id) as total_consultas,
  MAX(cr.created_at) as ultima_consulta,
  MIN(cr.created_at) as primera_consulta,
  STRING_AGG(DISTINCT cr.specialty, ', ') as especialidades,
  COUNT(DISTINCT DATE(cr.created_at)) as dias_con_consultas
FROM patients p
LEFT JOIN clinical_records cr ON p.id = cr.patient_id
GROUP BY p.id, p.first_name, p.last_name;

-- =============================================================================
-- SECCIÓN 5: CREAR TABLA DE CONVERSIÓN DE IDS
-- =============================================================================

/*
 * Esta tabla almacena el mapeo entre los IDs del CSV y los IDs reales en BD
 */

CREATE TABLE IF NOT EXISTS csv_to_db_id_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Información original del CSV
  csv_idcontacto VARCHAR(50) NOT NULL UNIQUE,
  csv_nombre VARCHAR(255),
  csv_apellidos VARCHAR(255),
  csv_numero_historial INTEGER,
  csv_estado VARCHAR(50),
  csv_documento_id VARCHAR(50),
  
  -- Mapeo a BD
  db_patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  
  -- Control de mapeo
  is_mapped BOOLEAN DEFAULT FALSE,
  mapping_date TIMESTAMP WITH TIME ZONE,
  mapped_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Validación
  total_historiales_en_csv INTEGER,
  total_historiales_en_db INTEGER,
  historiales_validados BOOLEAN DEFAULT FALSE,
  
  -- Auditoría
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- SECCIÓN 6: FUNCIÓN PARA VALIDAR MAPEOS
-- =============================================================================

CREATE OR REPLACE FUNCTION validate_patient_id_mapping(
  p_csv_idcontacto VARCHAR,
  p_db_patient_id UUID
)
RETURNS TABLE(
  is_valid BOOLEAN,
  message VARCHAR,
  csv_record_count INTEGER,
  db_record_count INTEGER
) AS $$
DECLARE
  v_csv_count INTEGER;
  v_db_count INTEGER;
BEGIN
  -- Contar historiales en CSV para este IDCONTACTO
  -- SELECT COUNT(*) INTO v_csv_count FROM csv_import_table WHERE IDCONTACTO = p_csv_idcontacto;
  
  -- Contar registros clínicos en BD para este patient_id
  SELECT COUNT(*) INTO v_db_count FROM clinical_records WHERE patient_id = p_db_patient_id;
  
  -- Validar
  IF p_db_patient_id IS NOT NULL AND v_db_count >= 0 THEN
    RETURN QUERY SELECT 
      true as is_valid,
      'Mapeo válido' as message,
      v_csv_count as csv_record_count,
      v_db_count as db_record_count;
  ELSE
    RETURN QUERY SELECT 
      false as is_valid,
      'Error en mapeo - patient_id no existe' as message,
      v_csv_count as csv_record_count,
      NULL as db_record_count;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- SECCIÓN 7: VISTA PARA DETECTAR DISCREPANCIAS
-- =============================================================================

CREATE OR REPLACE VIEW data_integrity_check AS
SELECT 
  ct.csv_idcontacto,
  ct.csv_nombre,
  ct.csv_apellidos,
  ct.db_patient_id,
  p.first_name as db_first_name,
  p.last_name as db_last_name,
  CASE 
    WHEN ct.csv_nombre IS NULL AND p.first_name IS NULL THEN 'OK'
    WHEN CONCAT(ct.csv_nombre, ' ', ct.csv_apellidos) LIKE CONCAT(p.first_name, '%', p.last_name) THEN 'OK'
    ELSE 'DISCREPANCIA' 
  END as nombre_match,
  ct.total_historiales_en_csv,
  (SELECT COUNT(*) FROM clinical_records WHERE patient_id = p.id) as total_historiales_en_db,
  ct.is_mapped,
  ct.created_at
FROM csv_to_db_id_mapping ct
LEFT JOIN patients p ON ct.db_patient_id = p.id;

-- =============================================================================
-- SECCIÓN 8: REPORTE DE INTEGRIDAD
-- =============================================================================

CREATE OR REPLACE FUNCTION generate_integrity_report()
RETURNS TABLE(
  section VARCHAR,
  metric VARCHAR,
  value VARCHAR,
  status VARCHAR
) AS $$
BEGIN
  -- Total de pacientes en mapeo
  RETURN QUERY SELECT 
    'Pacientes'::VARCHAR, 
    'Total en mapeo'::VARCHAR,
    COUNT(*)::VARCHAR, 
    'INFO'::VARCHAR
  FROM csv_to_db_id_mapping;
  
  -- Pacientes mapeados correctamente
  RETURN QUERY SELECT 
    'Pacientes'::VARCHAR,
    'Correctamente mapeados'::VARCHAR,
    COUNT(*)::VARCHAR,
    CASE WHEN COUNT(*) > 0 THEN 'OK' ELSE 'WARNING' END
  FROM csv_to_db_id_mapping
  WHERE is_mapped = true AND db_patient_id IS NOT NULL;
  
  -- Pacientes sin mapeo
  RETURN QUERY SELECT 
    'Pacientes'::VARCHAR,
    'Sin mapeo'::VARCHAR,
    COUNT(*)::VARCHAR,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'WARNING' END
  FROM csv_to_db_id_mapping
  WHERE is_mapped = false OR db_patient_id IS NULL;
  
  -- Discrepancias de nombres
  RETURN QUERY SELECT 
    'Validación'::VARCHAR,
    'Discrepancias en nombres'::VARCHAR,
    COUNT(*)::VARCHAR,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'WARNING' END
  FROM data_integrity_check
  WHERE nombre_match = 'DISCREPANCIA';
  
  -- Historiales sin paciente
  RETURN QUERY SELECT 
    'Integridad'::VARCHAR,
    'Historiales huérfanos'::VARCHAR,
    COUNT(*)::VARCHAR,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'ERROR' END
  FROM clinical_records cr
  WHERE NOT EXISTS (
    SELECT 1 FROM patients p WHERE p.id = cr.patient_id
  );
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- SECCIÓN 9: QUERY DE VERIFICACIÓN RÁPIDA
-- =============================================================================

-- Ver estadísticas generales
-- SELECT * FROM generate_integrity_report() ORDER BY section, metric;

-- Ver vista de integridad
-- SELECT * FROM data_integrity_check WHERE nombre_match = 'DISCREPANCIA';

-- Ver mapeos pendientes
-- SELECT csv_idcontacto, csv_nombre, csv_apellidos, db_patient_id 
-- FROM csv_to_db_id_mapping 
-- WHERE is_mapped = false
-- LIMIT 20;

-- =============================================================================
-- SECCIÓN 10: SCRIPT DE SINCRONIZACIÓN (MANUAL)
-- =============================================================================

/*
 * Para sincronizar manualmente IDs desde CSV a la BD:
 * 
 * 1. Obtener lista de IDCONTACTO del CSV
 * 2. Buscar el paciente correspondiente en la BD por nombre/apellido
 * 3. Crear entrada en csv_to_db_id_mapping
 * 4. Validar que los historiales coincidan
 * 5. Marcar como validado
 * 
 * Ejemplo:
 * 
 * INSERT INTO csv_to_db_id_mapping (
 *   csv_idcontacto, csv_nombre, csv_apellidos, csv_numero_historial,
 *   db_patient_id, is_mapped, mapping_date, mapped_by
 * )
 * SELECT 
 *   '35021367', 'ALI', 'AMRANI', 19,
 *   p.id, true, NOW(), auth.uid()
 * FROM patients p
 * WHERE p.first_name ILIKE 'ALI%' AND p.last_name ILIKE 'AMRANI%'
 * LIMIT 1;
 */

-- =============================================================================
-- SECCIÓN 11: CHECKLIST DE VALIDACIÓN
-- =============================================================================

/*
 * ☐ 1. Verificar que todos los IDCONTACTO del CSV de historiales
 *      existen en el CSV de contactos
 * 
 * ☐ 2. Verificar que los nombres en historiales.csv coinciden con
 *      los nombres en el CSV de contactos para el mismo IDCONTACTO
 * 
 * ☐ 3. Crear entrada en patients para cada paciente único en CSV
 *      con IDCONTACTO como identificador
 * 
 * ☐ 4. Crear mapeo en csv_to_db_id_mapping para cada paciente
 * 
 * ☐ 5. Validar que el count de historiales por paciente coincide
 *      entre CSV y BD
 * 
 * ☐ 6. Ejecutar generate_integrity_report() y revisar status
 * 
 * ☐ 7. Si hay discrepancias, investigar y corregir manualmente
 * 
 * ☐ 8. Marcar todos los mapeos como validados
 * 
 * ☐ 9. Crear backup de la BD antes de proceder a producción
 * 
 * ☐ 10. Probar que la aplicación puede acceder a historiales
 *       correctamente por patient_id
 */

-- =============================================================================
-- FIN DE GUÍA DE VERIFICACIÓN
-- =============================================================================
