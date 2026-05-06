-- ============================================================================
-- LIMPIEZA: Entradas "RECETA:" en ClinicalRecord
-- ============================================================================
--
-- CONTEXTO:
--   Antes de esta corrección, cada vez que se guardaba una receta el sistema
--   creaba automáticamente un registro en ClinicalRecord con el prefijo
--   "RECETA:" en el campo treatment.  Esas entradas se mostraban mezcladas con
--   las notas clínicas de los doctores en la pestaña "Evolución Clínica".
--
--   Este script hace un soft-delete de todas esas entradas históricas para
--   dejar la Evolución Clínica limpia.  Los datos de las recetas siguen
--   intactos en la tabla Prescription.
--
-- ⚠️  Ejecutar en orden.  Confirmar PASO 1 antes de PASO 2.
-- ============================================================================


-- ============================================================================
-- PASO 1: VERIFICAR cuántas entradas "RECETA:" existen
-- ============================================================================

SELECT
    COUNT(*)                        AS total_entradas_receta,
    MIN("date"::date)               AS primera_fecha,
    MAX("date"::date)               AS ultima_fecha
FROM "ClinicalRecord"
WHERE deleted_at IS NULL
  AND (
      -- Texto plano que empieza directamente por RECETA:
      text ILIKE 'RECETA:%'
      OR
      -- JSON con "treatment":"RECETA:..." (sin espacio tras los dos puntos)
      text LIKE '%"treatment":"RECETA:%'
      OR
      -- JSON con "treatment": "RECETA:..." (con espacio tras los dos puntos)
      text LIKE '%"treatment": "RECETA:%'
  );

-- Si el resultado es 0 → no hay nada que limpiar, el script terminó.
-- Si hay registros → continuar con PASO 2.


-- ============================================================================
-- PASO 2: SOFT-DELETE de todas las entradas "RECETA:" en ClinicalRecord
-- ============================================================================

UPDATE "ClinicalRecord"
SET deleted_at = NOW()
WHERE deleted_at IS NULL
  AND (
      text ILIKE 'RECETA:%'
      OR
      text LIKE '%"treatment":"RECETA:%'
      OR
      text LIKE '%"treatment": "RECETA:%'
  );

-- Muestra cuántas filas fueron marcadas como eliminadas
-- (debería coincidir con el COUNT del PASO 1)


-- ============================================================================
-- PASO 3: VERIFICAR que ya no quedan entradas "RECETA:" activas
-- ============================================================================

SELECT COUNT(*) AS deben_ser_cero
FROM "ClinicalRecord"
WHERE deleted_at IS NULL
  AND (
      text ILIKE 'RECETA:%'
      OR
      text LIKE '%"treatment":"RECETA:%'
      OR
      text LIKE '%"treatment": "RECETA:%'
  );

-- Resultado esperado: 0
