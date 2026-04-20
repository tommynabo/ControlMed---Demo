-- ============================================================
-- PASO 1: DIAGNÓSTICO — Ver pacientes con historyNumber
--         sin prefijo HC- (números sueltos)
-- ============================================================
SELECT id, name, "historyNumber"
FROM "Patient"
WHERE "historyNumber" IS NOT NULL
  AND "historyNumber" NOT LIKE 'HC-%'
  AND "historyNumber" NOT LIKE 'HCL-%'
ORDER BY "historyNumber";

-- ============================================================
-- PASO 2: CONTAR cuántos pacientes tienen formato incorrecto
-- ============================================================
SELECT COUNT(*) AS pacientes_sin_prefijo
FROM "Patient"
WHERE "historyNumber" IS NOT NULL
  AND "historyNumber" NOT LIKE 'HC-%'
  AND "historyNumber" NOT LIKE 'HCL-%';

-- ============================================================
-- PASO 3: VER el número máximo actual en formato correcto
-- ============================================================
SELECT MAX(CAST(SUBSTRING("historyNumber" FROM 4) AS INTEGER)) AS max_historial
FROM "Patient"
WHERE "historyNumber" LIKE 'HC-%'
  AND "historyNumber" ~ '^HC-[0-9]+$';

-- ============================================================
-- PASO 4: NORMALIZAR — Convertir números sueltos a HC-XXXX
--
-- Detecta conflictos antes de actualizar: si ya existe HC-XXXX
-- para ese número, el paciente duplicado queda sin historial
-- (se pondrá NULL para evitar violación de unicidad).
--
-- ⚠️ EJECUTAR SOLO DESPUÉS DE REVISAR LOS PASOS 1-3
-- ============================================================

-- 4a. Poner NULL a los que colisionarían con un HC- existente
UPDATE "Patient" p
SET "historyNumber" = NULL
WHERE "historyNumber" IS NOT NULL
  AND "historyNumber" NOT LIKE 'HC-%'
  AND "historyNumber" NOT LIKE 'HCL-%'
  AND "historyNumber" ~ '^[0-9]+$'
  AND EXISTS (
      SELECT 1 FROM "Patient" p2
      WHERE p2."historyNumber" = 'HC-' || LPAD(p."historyNumber", 4, '0')
        AND p2.id <> p.id
  );

-- 4b. Normalizar los restantes (sin conflicto) a HC-XXXX
UPDATE "Patient"
SET "historyNumber" = 'HC-' || LPAD("historyNumber", 4, '0')
WHERE "historyNumber" IS NOT NULL
  AND "historyNumber" NOT LIKE 'HC-%'
  AND "historyNumber" NOT LIKE 'HCL-%'
  AND "historyNumber" ~ '^[0-9]+$';

-- ============================================================
-- PASO 5: VERIFICACIÓN — Confirmar que todos tienen HC- o NULL
-- ============================================================
SELECT
    COUNT(*) FILTER (WHERE "historyNumber" LIKE 'HC-%') AS con_prefijo_hc,
    COUNT(*) FILTER (WHERE "historyNumber" IS NULL)     AS sin_historial,
    COUNT(*) FILTER (WHERE "historyNumber" IS NOT NULL AND "historyNumber" NOT LIKE 'HC-%') AS formato_incorrecto
FROM "Patient";
