-- ============================================================================
-- FIX: Registros clínicos duplicados — todos los pacientes
-- ============================================================================
-- Causa: los scripts de importación (restore.js / import_complete_data.js)
-- se ejecutaron varias veces sin protección dedup, creando el mismo registro
-- N veces con IDs distintos. La tabla NO tiene columna "createdAt"; el
-- timestamp disponible es "date" (fecha de la nota clínica).
--
-- Estrategia: para cada grupo (patientId, text, date::date) conservamos
-- el registro con el id lexicográficamente menor (el más antiguo según UUID v4
-- o el primero insertado) y eliminamos el resto.
--
-- INSTRUCCIONES:
--   1. Ejecutar PASO 1 → verifica cuántos registros se van a eliminar.
--   2. Si el número es razonable, ejecutar PASO 2 (DELETE).
--   3. Verificar con PASO 3 → debe devolver 0 filas.
--
-- ⚠️  Ejecutar en Supabase → SQL Editor (desactivar límite de 100 filas)
-- ============================================================================


-- ─── PASO 1: Preview — ¿cuántos duplicados hay? ──────────────────────────────
SELECT
    COUNT(*)                              AS total_registros,
    COUNT(*) FILTER (WHERE rn > 1)        AS registros_a_eliminar,
    COUNT(*) FILTER (WHERE rn = 1)        AS registros_a_conservar
FROM (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY "patientId", text, date::date
            ORDER BY date ASC, id ASC
        ) AS rn
    FROM "ClinicalRecord"
    WHERE deleted_at IS NULL
) ranked;


-- ─── PASO 2: DELETE duplicados (soft-delete para mantener auditoría) ─────────
-- Opción A — Soft delete (recomendado: mantiene auditoría, reversible)
UPDATE "ClinicalRecord"
SET deleted_at = NOW()
WHERE id IN (
    SELECT id
    FROM (
        SELECT
            id,
            ROW_NUMBER() OVER (
                PARTITION BY "patientId", text, date::date
                ORDER BY date ASC, id ASC
            ) AS rn
        FROM "ClinicalRecord"
        WHERE deleted_at IS NULL
    ) ranked
    WHERE rn > 1
);

-- Opción B — Hard delete (si prefieres limpiar la tabla completamente)
-- DELETE FROM "ClinicalRecord"
-- WHERE id IN (
--     SELECT id
--     FROM (
--         SELECT
--             id,
--             ROW_NUMBER() OVER (
--                 PARTITION BY "patientId", text, date::date
--                 ORDER BY date ASC, id ASC
--             ) AS rn
--         FROM "ClinicalRecord"
--         WHERE deleted_at IS NULL
--     ) ranked
--     WHERE rn > 1
-- );


-- ─── PASO 3: Verificación final — debe devolver 0 filas ──────────────────────
SELECT
    "patientId",
    date::date   AS fecha,
    LEFT(text, 60) AS texto_inicio,
    COUNT(*)     AS num_duplicados
FROM "ClinicalRecord"
WHERE deleted_at IS NULL
GROUP BY "patientId", date::date, text
HAVING COUNT(*) > 1
ORDER BY num_duplicados DESC;
