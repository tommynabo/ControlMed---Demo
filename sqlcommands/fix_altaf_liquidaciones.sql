-- ══════════════════════════════════════════════════════════════════════════
-- Limpiar liquidaciones incorrectas de Altaf Ahmed
-- El split usó todos los ítems del presupuesto en lugar de solo los de la cita
-- ══════════════════════════════════════════════════════════════════════════

-- PASO 1: Ver todas las liquidaciones de Altaf para identificar las incorrectas
SELECT
    l.id,
    l."treatmentName",
    l."grossAmount",
    l."itemIndex",
    l."appointmentId",
    l."doctorId",
    l."createdAt"
FROM "Liquidation" l
WHERE l."patientName" ILIKE '%Altaf%'
   OR l."patientName" ILIKE '%Ahmed%'
ORDER BY l."appointmentId", l."itemIndex", l."createdAt" DESC;

-- PASO 2: Ver qué ítems tiene el presupuesto de su cita vs. qué tenía la cita asignada
-- (sustituye <appointmentId> con el valor del paso 1)
/*
SELECT
    a.id         AS appointment_id,
    a."budgetId",
    a."budgetItemIds",
    a."treatmentName",
    a.date
FROM "Appointment" a
WHERE a.id = '<appointmentId>';

-- Ver todos los ítems del presupuesto
SELECT bli.id, bli.name, bli.price
FROM "BudgetLineItem" bli
WHERE bli."budgetId" = '<budgetId>'
ORDER BY bli.id;
*/

-- PASO 3: Borrar las 14 filas incorrectas de Altaf Ahmed
-- appointmentId: 8d07264d-1314-4bb7-9af9-8a9de07e94d7 (usó todo el presupuesto, no solo los conceptos de esa cita)
DELETE FROM "Liquidation"
WHERE "appointmentId" = '8d07264d-1314-4bb7-9af9-8a9de07e94d7'
  AND "doctorId" = 'afbe7957-23fb-4e90-a7b5-d1519e514984';
-- Verifica que borró 14 filas (itemIndex 0..13). Las otras 2 filas de Altaf son correctas (distinto appointmentId).

-- PASO 4 (opcional): Si prefieres recrear las filas manualmente con los importes correctos
-- en lugar de volver a cobrar, usa INSERT después del DELETE del paso 3.
