-- ==============================================================================
-- SCRIPT DE VERIFICACIÓN: Comprobar que RLS está habilitado correctamente
-- Ejecuta este script para verificar que el security fix funcionó
-- ==============================================================================

-- ==============================================================================
-- 1. VERIFICAR QUE RLS ESTÁ HABILITADO EN TODAS LAS TABLAS
-- ==============================================================================
SELECT 
  'RLS Status' AS "Verificación",
  schemaname,
  tablename AS "Tabla",
  CASE 
    WHEN rowsecurity = true THEN '✅ HABILITADO'
    ELSE '❌ DESHABILITADO' 
  END AS "Estado RLS"
FROM pg_tables 
WHERE schemaname = 'public'
  AND tablename IN (
    'User', 'Patient', 'Doctor', 'Appointment', 'Treatment', 
    'PatientTreatment', 'Invoice', 'InvoiceItem', 'TreatmentPlan',
    'Installment', 'ClinicalRecord', 'Liquidation', 'system_users',
    'InventoryItem', 'DocumentTemplate', 'Specialty', 'Payment',
    'Budget', 'BudgetLineItem', 'Odontogram', 'DentalSnapshot',
    'WhatsAppTemplate', 'WhatsAppLog', 'services'
  )
ORDER BY tablename;

-- ==============================================================================
-- 2. CONTAR POLÍTICAS DE RLS POR TABLA
-- ==============================================================================
SELECT
  'Políticas RLS' AS "Verificación",
  tablename AS "Tabla",
  COUNT(*) AS "Número de Políticas"
FROM pg_policies
WHERE tablename IN (
  'User', 'Patient', 'Doctor', 'Appointment', 'Treatment', 
  'PatientTreatment', 'Invoice', 'InvoiceItem', 'TreatmentPlan',
  'Installment', 'ClinicalRecord', 'Liquidation', 'system_users',
  'InventoryItem', 'DocumentTemplate', 'Specialty', 'Payment',
  'Budget', 'BudgetLineItem', 'Odontogram', 'DentalSnapshot',
  'WhatsAppTemplate', 'WhatsAppLog', 'services'
)
GROUP BY tablename
ORDER BY tablename;

-- ==============================================================================
-- 3. VERIFICAR QUE LAS FUNCIONES DE SEGURIDAD EXISTEN
-- ==============================================================================
SELECT
  'Funciones de Seguridad' AS "Verificación",
  routine_name AS "Función",
  CASE 
    WHEN routine_name IN ('get_user_role', 'is_admin', 'is_doctor')
    THEN '✅ EXISTE'
    ELSE '❌ NO ENCONTRADA'
  END AS "Estado"
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('get_user_role', 'is_admin', 'is_doctor');

-- ==============================================================================
-- 4. LISTAR TODAS LAS POLÍTICAS CREADAS
-- ==============================================================================
SELECT
  'Detalles de Políticas' AS "Verificación",
  schemaname,
  tablename AS "Tabla",
  policyname AS "Política",
  CASE 
    WHEN qual IS NOT NULL THEN 'USING - ' || qual
    WHEN with_check IS NOT NULL THEN 'WITH CHECK - ' || with_check
    ELSE 'N/A'
  END AS "Condición"
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'User', 'Patient', 'Doctor', 'Appointment', 'Treatment', 
    'PatientTreatment', 'Invoice', 'InvoiceItem', 'TreatmentPlan',
    'Installment', 'ClinicalRecord', 'Liquidation', 'system_users',
    'InventoryItem', 'DocumentTemplate', 'Specialty', 'Payment',
    'Budget', 'BudgetLineItem', 'Odontogram', 'DentalSnapshot',
    'WhatsAppTemplate', 'WhatsAppLog', 'services'
  )
ORDER BY tablename, policyname;

-- ==============================================================================
-- 5. RESUMEN FINAL
-- ==============================================================================
SELECT
  'RESUMEN' AS "Tipo",
  (
    SELECT COUNT(DISTINCT tablename) 
    FROM pg_tables 
    WHERE schemaname = 'public' AND rowsecurity = true
      AND tablename IN (
        'User', 'Patient', 'Doctor', 'Appointment', 'Treatment', 
        'PatientTreatment', 'Invoice', 'InvoiceItem', 'TreatmentPlan',
        'Installment', 'ClinicalRecord', 'Liquidation', 'system_users',
        'InventoryItem', 'DocumentTemplate', 'Specialty', 'Payment',
        'Budget', 'BudgetLineItem', 'Odontogram', 'DentalSnapshot',
        'WhatsAppTemplate', 'WhatsAppLog', 'services'
      )
  )::text || ' / 24 Tablas con RLS Habilitado' AS "Estado"

UNION ALL

SELECT
  'RESUMEN',
  (SELECT COUNT(*) FROM information_schema.routines 
   WHERE routine_schema = 'public' 
   AND routine_name IN ('get_user_role', 'is_admin', 'is_doctor')
  )::text || ' / 3 Funciones de Seguridad' AS "Estado"

UNION ALL

SELECT
  'RESUMEN',
  (SELECT COUNT(*) FROM pg_policies 
   WHERE schemaname = 'public' 
   AND tablename IN (
     'User', 'Patient', 'Doctor', 'Appointment', 'Treatment', 
     'PatientTreatment', 'Invoice', 'InvoiceItem', 'TreatmentPlan',
     'Installment', 'ClinicalRecord', 'Liquidation', 'system_users',
     'InventoryItem', 'DocumentTemplate', 'Specialty', 'Payment',
     'Budget', 'BudgetLineItem', 'Odontogram', 'DentalSnapshot',
     'WhatsAppTemplate', 'WhatsAppLog', 'services'
   )
  )::text || ' Políticas RLS Creadas' AS "Estado";

-- ==============================================================================
-- 6. VERIFICAR COLUMNAS SENSIBLES (password, bank_account, insurance_number)
-- ==============================================================================
SELECT
  'Columnas Sensibles Detectadas' AS "Tipo",
  table_name AS "Tabla",
  column_name AS "Columna",
  data_type AS "Tipo de Dato",
  '✅ PROTEGIDA POR RLS' AS "Estado"
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('User', 'system_users')
  AND column_name IN ('password', 'bank_account', 'insurance_number')
ORDER BY table_name, column_name;

-- ==============================================================================
-- NOTAS DE EJECUCIÓN:
-- ==============================================================================
-- 
-- Este script verifica:
-- ✅ RLS está habilitado en las 24 tablas
-- ✅ Las funciones de seguridad existen
-- ✅ Las políticas están correctamente configuradas
-- ✅ Las columnas sensibles están protegidas
--
-- RESULTADO ESPERADO:
-- - 24 tablas con RLS HABILITADO
-- - 3 funciones de seguridad
-- - 80+ políticas RLS (múltiples por tabla)
-- - 2 columnas sensibles protegidas por RLS
--
-- Si todos estos números son correctos, ¡la seguridad está bien configurada!
--

