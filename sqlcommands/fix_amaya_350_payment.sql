-- ============================================================================
-- FIX: Cobro de 350€ de Amaya Espiga Alonzo del 17/04/2026 → corregir a 175€
-- ============================================================================
--
-- Contexto: En la facturación del 17/04/2026 aparece un cobro de 350€ a
-- Amaya Espiga Alonzo con notas "HA PAGADO 175€ EL 17/04". El importe correcto
-- es 175€ (pago parcial de un tratamiento).
--
-- INSTRUCCIONES:
--   1. Ejecutar primero el SELECT de verificación para confirmar el pago correcto.
--   2. Si el resultado muestra exactamente 1 fila, ejecutar el bloque UPDATE.
--   3. Si aparecen 0 o múltiples filas, ajustar el filtro antes de continuar.
-- ============================================================================

-- PASO 1: Verificar el pago a corregir
SELECT
    p.id             AS payment_id,
    p.amount,
    p.notes,
    p."createdAt",
    p."doctorId",
    p."invoiceId",
    pat.name         AS patient_name
FROM "Payment" p
JOIN "Patient" pat ON pat.id = p."patientId"
WHERE pat.name ILIKE '%amaya%espiga%'
  AND p.amount = 350
  AND p."createdAt"::date = '2026-04-17';

-- ============================================================================
-- PASO 2: Corregir el importe en Payment e Invoice
-- (Ejecutar solo después de confirmar la fila en el paso 1)
-- ============================================================================

-- 2a. Actualizar Payment
UPDATE "Payment"
SET amount = 175
WHERE id = (
    SELECT p.id
    FROM "Payment" p
    JOIN "Patient" pat ON pat.id = p."patientId"
    WHERE pat.name ILIKE '%amaya%espiga%'
      AND p.amount = 350
      AND p."createdAt"::date = '2026-04-17'
    LIMIT 1
);

-- 2b. Actualizar Invoice vinculado (mantiene consistencia)
UPDATE "Invoice"
SET amount = 175
WHERE id = (
    SELECT p."invoiceId"
    FROM "Payment" p
    JOIN "Patient" pat ON pat.id = p."patientId"
    WHERE pat.name ILIKE '%amaya%espiga%'
      AND p.amount = 350
      AND p."createdAt"::date = '2026-04-17'
    LIMIT 1
);

-- PASO 3: Verificar resultado final
SELECT
    p.id             AS payment_id,
    p.amount         AS payment_amount,
    i.amount         AS invoice_amount,
    p.notes,
    p."createdAt",
    pat.name         AS patient_name
FROM "Payment" p
JOIN "Patient" pat ON pat.id = p."patientId"
LEFT JOIN "Invoice" i ON i.id = p."invoiceId"
WHERE pat.name ILIKE '%amaya%espiga%'
  AND p."createdAt"::date = '2026-04-17'
ORDER BY p."createdAt";
-- Resultado esperado: fila con amount = 175 en Payment e Invoice
