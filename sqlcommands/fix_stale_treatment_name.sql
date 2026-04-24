-- ==============================================================================
-- DIAGNÓSTICO: Citas con treatmentName sospechoso
-- Busca citas que:
--   1. Tienen treatmentName pero NO tienen budgetId ni serviceIds
--   2. El paciente no tiene historial previo que justifique ese tratamiento
-- Ejecutar primero para ver qué citas están afectadas
-- ==============================================================================

-- Ver citas con tratamiento pero sin presupuesto vinculado (posibles corruptas)
-- Nota: serviceIds no se persiste en BD (sólo se usa para resolver treatmentName en el backend)
SELECT
    a.id,
    a.date,
    a.time,
    p.name AS patient_name,
    p."historyNumber",
    a."treatmentName",
    a."budgetId"
FROM "Appointment" a
JOIN "Patient" p ON p.id = a."patientId"
WHERE
    a.deleted_at IS NULL
    AND a."treatmentName" IS NOT NULL
    AND a."budgetId" IS NULL
ORDER BY a.date DESC
LIMIT 50;


-- ==============================================================================
-- CORRECCIÓN: Limpiar treatmentName de citas de "primera visita" sin presupuesto
-- IMPORTANTE: Revisar los resultados del SELECT anterior antes de ejecutar esto.
-- Reemplaza 'APPOINTMENT_ID_AQUI' con el ID real de la cita afectada.
-- ==============================================================================

-- Para limpiar una cita concreta:
-- UPDATE "Appointment"
-- SET "treatmentName" = NULL
-- WHERE id = 'APPOINTMENT_ID_AQUI';

-- CASO CONCRETO: SERGI SABATER MIMBRERO, 23/04/2026 17:30
-- Primero verificar el ID:
SELECT a.id, a.date, a.time, a."treatmentName", p.name
FROM "Appointment" a
JOIN "Patient" p ON p.id = a."patientId"
WHERE p.name ILIKE '%SERGI SABATER%'
  AND a.deleted_at IS NULL
ORDER BY a.date DESC;

-- Una vez confirmado el ID, limpiar:
-- UPDATE "Appointment"
-- SET "treatmentName" = NULL
-- WHERE id = 'ID_DE_SERGI_AQUI';


-- Para limpiar todas las citas sin presupuesto
-- que tengan un treatmentName (CUIDADO: revisar el SELECT primero):
-- UPDATE "Appointment"
-- SET "treatmentName" = NULL
-- WHERE
--     deleted_at IS NULL
--     AND "treatmentName" IS NOT NULL
--     AND "budgetId" IS NULL;
