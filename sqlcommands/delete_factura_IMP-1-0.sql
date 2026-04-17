-- ============================================================================
-- ELIMINAR FACTURA IMP-1-0 (MARC CABRERIZO FARRE)
-- ============================================================================
--
-- INSTRUCCIONES:
--   1. Ejecutar PASO 1 y verificar que se muestra exactamente 1 fila con los
--      datos correctos (paciente CABRERIZO, importe esperado).
--   2. Si el resultado es correcto, ejecutar PASO 2 (eliminación).
--   3. Ejecutar PASO 3 para confirmar que la factura ya no existe.
--
-- ⚠️  IMPORTANTE: No ejecutar PASO 2 sin haber confirmado PASO 1 primero.
-- ============================================================================


-- ============================================================================
-- PASO 1: VERIFICACIÓN — confirma la factura y el paciente antes de borrar
-- ============================================================================

SELECT
    i.id            AS invoice_id,
    i."invoiceNumber",
    i.amount,
    i.date,
    i.status,
    i.concept,
    p.name          AS patient_name,
    p.dni
FROM "Invoice" i
JOIN "Patient" p ON p.id = i."patientId"
WHERE i."invoiceNumber" = 'IMP-1-0'
  AND p.name ILIKE '%CABRERIZO%';


-- ============================================================================
-- PASO 2: ELIMINACIÓN
-- ============================================================================
-- Ejecutar solo tras confirmar PASO 1.

DO $$
DECLARE
    v_invoice_id TEXT;
BEGIN
    -- Localizar la factura
    SELECT i.id INTO v_invoice_id
    FROM "Invoice" i
    JOIN "Patient" p ON p.id = i."patientId"
    WHERE i."invoiceNumber" = 'IMP-1-0'
      AND p.name ILIKE '%CABRERIZO%'
    LIMIT 1;

    IF v_invoice_id IS NULL THEN
        RAISE EXCEPTION 'ABORTADO: No se encontró la factura IMP-1-0 para el paciente CABRERIZO. Verifica el número de factura y el nombre.';
    END IF;

    -- 1. Desligar la factura de los pagos asociados
    UPDATE "Payment"
    SET "invoiceId" = NULL
    WHERE "invoiceId" = v_invoice_id;

    -- 2. Eliminar líneas de factura
    DELETE FROM "InvoiceItem"
    WHERE "invoiceId" = v_invoice_id;

    -- 3. Eliminar la factura
    DELETE FROM "Invoice"
    WHERE id = v_invoice_id;

    RAISE NOTICE '✅ Factura IMP-1-0 eliminada correctamente (id: %).', v_invoice_id;
END $$;


-- ============================================================================
-- PASO 3: VERIFICACIÓN POST — debe devolver 0 filas
-- ============================================================================

SELECT id, "invoiceNumber", "patientId"
FROM "Invoice"
WHERE "invoiceNumber" = 'IMP-1-0';
