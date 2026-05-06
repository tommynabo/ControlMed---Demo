-- ============================================================================
-- ELIMINAR COBRO SIN FACTURA: EDUARDO DIMAS RODRIGUEZ — 20/04/2026
-- ============================================================================
--
-- DIAGNÓSTICO: El Payment del 20/04 NO existe en la tabla Payment.
-- La entrada del 20/04 proviene de una Invoice huérfana (sin Payment vinculado).
-- Solo hay que eliminar esa Invoice (y sus InvoiceItems).
--
-- ⚠️  Ejecutar en orden. NO ejecutar PASO 2 sin confirmar PASO 1.
-- ============================================================================


-- ============================================================================
-- PASO 1: TODAS las facturas de Eduardo Dimas (sin filtros)
-- ============================================================================

SELECT
    i.id              AS invoice_id,
    i."invoiceNumber",
    i.amount,
    i.date,
    i.date::date      AS fecha,
    i.status,
    i.concept,
    i."paymentMethod",
    i."relatedPaymentId"
FROM "Invoice" i
JOIN "Patient" pat ON pat.id = i."patientId"
WHERE pat.name ILIKE '%Eduardo%Dimas%'
ORDER BY i.date ASC;

-- Muestra TODAS las facturas. Identifica la del 20/04 y anota su invoice_id.


-- ============================================================================
-- PASO 1B: (DIAGNÓSTICO AMPLIO) Todos los payments de Eduardo Dimas
-- ============================================================================

SELECT
    p.id,
    p."createdAt",
    p.amount,
    p.method,
    p.type,
    p."invoiceId"
FROM "Payment" p
JOIN "Patient" pat ON pat.id = p."patientId"
WHERE pat.name ILIKE '%Eduardo%Dimas%'
ORDER BY p."createdAt" ASC;

-- Resultado esperado: solo 1 fila → el del 21/04 (cash, con factura).


-- ============================================================================
-- PASO 2: ELIMINAR la Invoice huérfana del 20/04/2026
-- ============================================================================

DO $$
DECLARE
    v_patient_id  TEXT;
    v_invoice_id  TEXT;
BEGIN
    -- Obtener el patientId de Eduardo Dimas
    SELECT id INTO v_patient_id
    FROM "Patient"
    WHERE name ILIKE '%Eduardo%Dimas%'
    LIMIT 1;

    IF v_patient_id IS NULL THEN
        RAISE EXCEPTION 'ABORTADO: No se encontró al paciente Eduardo Dimas Rodriguez.';
    END IF;

    -- Seleccionar la Invoice del 20/04/2026
    SELECT id INTO v_invoice_id
    FROM "Invoice"
    WHERE "patientId"  = v_patient_id
      AND date::date   = '2026-04-20'
      AND amount       = 60
    ORDER BY date ASC
    LIMIT 1;

    IF v_invoice_id IS NULL THEN
        RAISE EXCEPTION 'ABORTADO: No se encontró ninguna factura de 60€ del 20/04/2026 para este paciente.';
    END IF;

    RAISE NOTICE 'Invoice a eliminar → invoice_id: %', v_invoice_id;

    -- Eliminar las líneas de factura
    DELETE FROM "InvoiceItem"
    WHERE "invoiceId" = v_invoice_id;

    RAISE NOTICE 'InvoiceItems eliminados.';

    -- Desligar cualquier Payment que apunte a esta Invoice (por seguridad)
    UPDATE "Payment"
    SET "invoiceId" = NULL
    WHERE "invoiceId" = v_invoice_id;

    -- Eliminar la Invoice
    DELETE FROM "Invoice"
    WHERE id = v_invoice_id;

    RAISE NOTICE '✅ Invoice eliminada: %', v_invoice_id;
    RAISE NOTICE '✅ El cobro del 20/04/2026 ya no aparecerá en la caja ni en cobros de Eduardo Dimas.';
END $$;


-- ============================================================================
-- PASO 3: VERIFICAR que ya no existe la Invoice del 20/04
-- ============================================================================

SELECT
    i.id,
    i."invoiceNumber",
    i.amount,
    i.date::date AS fecha,
    i.status
FROM "Invoice" i
JOIN "Patient" pat ON pat.id = i."patientId"
WHERE pat.name ILIKE '%Eduardo%Dimas%'
ORDER BY i.date ASC;

-- Resultado esperado: solo la factura del 21/04 (F-2026-1776764423834).
