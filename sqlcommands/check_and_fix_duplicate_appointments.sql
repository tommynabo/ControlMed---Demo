-- ============================================================
-- PASO 1: DIAGNÓSTICO — Ver citas duplicadas (mismo paciente,
--         doctor, fecha y hora, no borradas)
-- ============================================================
SELECT
    "patientId",
    "doctorId",
    "date",
    "time",
    COUNT(*) AS total_duplicados,
    array_agg("id" ORDER BY ctid) AS ids
FROM "Appointment"
WHERE "deleted_at" IS NULL
GROUP BY "patientId", "doctorId", "date", "time"
HAVING COUNT(*) > 1
ORDER BY total_duplicados DESC;

-- ============================================================
-- PASO 2: CONTAR cuántas citas afectadas hay en total
-- ============================================================
SELECT COUNT(*) AS filas_duplicadas
FROM (
    SELECT "patientId", "doctorId", "date", "time"
    FROM "Appointment"
    WHERE "deleted_at" IS NULL
    GROUP BY "patientId", "doctorId", "date", "time"
    HAVING COUNT(*) > 1
) sub;

-- ============================================================
-- PASO 3: ELIMINAR duplicados — conserva el registro más
--         antiguo (menor createdAt) de cada grupo.
--
-- ⚠️ EJECUTAR SOLO DESPUÉS DE REVISAR EL PASO 1
-- ============================================================
DELETE FROM "Appointment"
WHERE id IN (
    SELECT id FROM (
        SELECT
            id,
            ROW_NUMBER() OVER (
                PARTITION BY "patientId", "doctorId", "date", "time"
                ORDER BY ctid ASC
            ) AS rn
        FROM "Appointment"
        WHERE "deleted_at" IS NULL
    ) ranked
    WHERE rn > 1
);

-- ============================================================
-- PASO 4: VERIFICACIÓN — Confirmar que ya no hay duplicados
-- ============================================================
SELECT COUNT(*) AS duplicados_restantes
FROM (
    SELECT "patientId", "doctorId", "date", "time"
    FROM "Appointment"
    WHERE "deleted_at" IS NULL
    GROUP BY "patientId", "doctorId", "date", "time"
    HAVING COUNT(*) > 1
) sub;
