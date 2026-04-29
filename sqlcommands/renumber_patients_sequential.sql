-- ============================================================
-- RENUMERACIÓN SECUENCIAL DE PACIENTES
-- Asigna HC-1, HC-2, HC-3, ... ordenados por createdAt ASC
--
-- ⚠️  EJECUTAR EN SUPABASE SQL EDITOR
-- ⚠️  HACE UN UPDATE MASIVO — verificar antes con el SELECT de diagnóstico
-- ============================================================

-- ── PASO 1: DIAGNÓSTICO PREVIO ────────────────────────────────────────────────
-- Ver cuántos pacientes hay y cuántos tienen historyNumber anómalo
SELECT
    COUNT(*)                                                    AS total_pacientes,
    COUNT(*) FILTER (WHERE "historyNumber" IS NULL)             AS sin_numero,
    COUNT(*) FILTER (WHERE "historyNumber" LIKE 'HC-%')         AS con_prefijo_hc,
    MIN("historyNumber")                                        AS minimo,
    MAX("historyNumber")                                        AS maximo
FROM "Patient";

-- Ver los 10 pacientes con números más altos (posibles outliers)
SELECT name, "historyNumber", "createdAt"
FROM "Patient"
ORDER BY
    CASE WHEN "historyNumber" ~ '^HC-[0-9]+$'
         THEN CAST(SUBSTRING("historyNumber" FROM 4) AS INTEGER)
         ELSE 0
    END DESC
LIMIT 10;

-- ── PASO 2: RENUMERACIÓN MASIVA ───────────────────────────────────────────────
-- Asigna HC-1, HC-2, HC-3, ... en orden de antigüedad (createdAt ASC)
-- El id se usa como tiebreaker cuando dos pacientes tienen el mismo createdAt
WITH ranked AS (
    SELECT
        id,
        ROW_NUMBER() OVER (ORDER BY "createdAt" ASC, id ASC) AS rn
    FROM "Patient"
)
UPDATE "Patient" p
SET "historyNumber" = 'HC-' || r.rn
FROM ranked r
WHERE p.id = r.id;

-- ── PASO 3: VERIFICACIÓN POST-UPDATE ─────────────────────────────────────────
-- No debe devolver ninguna fila (si la hay, hay duplicados → problema)
SELECT "historyNumber", COUNT(*) AS repeticiones
FROM "Patient"
GROUP BY "historyNumber"
HAVING COUNT(*) > 1;

-- Confirmar que los últimos registros tienen los números más altos
SELECT name, "historyNumber", "createdAt"
FROM "Patient"
ORDER BY "createdAt" DESC
LIMIT 15;

-- Confirmar rango completo: debe ser HC-1 hasta HC-{total}
SELECT
    COUNT(*)    AS total_pacientes,
    MIN("historyNumber")  AS primer_numero,
    MAX("historyNumber")  AS ultimo_numero,
    COUNT(*) FILTER (WHERE "historyNumber" IS NULL) AS sin_numero
FROM "Patient";
