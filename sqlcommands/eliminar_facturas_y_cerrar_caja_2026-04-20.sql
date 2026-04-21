-- ============================================================================
-- ELIMINAR FACTURAS INCORRECTAS Y CERRAR CAJA: 20/04/2026
-- ============================================================================
--
-- Facturas a eliminar (nunca cobradas, aparecen por error en la caja):
--   · F-2026-1776683752774  → EDUARDO DIMAS
--   · IMP-1-0               → MARC CABRERIZO FARRÉ
--
-- INSTRUCCIONES:
--   1. Ejecutar PASO 1 para confirmar que aparecen exactamente 2 filas.
--   2. Si es correcto, ejecutar PASO 2 (elimina F-2026-1776683752774).
--   3. Ejecutar PASO 3 (elimina IMP-1-0).
--   4. Ejecutar PASO 4 para ver el resumen de caja limpio (sin las dos facturas).
--   5. Ejecutar PASO 5 para registrar el cierre oficial de la caja del 20/04/2026.
--   6. Ejecutar PASO 6 para verificar que el cierre quedó guardado.
--
-- ⚠️  NO ejecutar PASO 2/3 sin haber confirmado PASO 1.
-- ⚠️  NO ejecutar PASO 5 sin haber revisado el resumen en PASO 4.
-- ============================================================================


-- ============================================================================
-- PASO 1: VERIFICAR las dos facturas a eliminar
-- ============================================================================

SELECT
    i."invoiceNumber",
    i.amount,
    i.date::date   AS fecha,
    i.status,
    i.concept,
    p.name         AS paciente
FROM "Invoice" i
JOIN "Patient" p ON p.id = i."patientId"
WHERE i."invoiceNumber" IN ('F-2026-1776683752774', 'IMP-1-0')
ORDER BY i."invoiceNumber";

-- Resultado esperado: 2 filas
--   F-2026-1776683752774 → EDUARDO DIMAS
--   IMP-1-0              → MARC CABRERIZO FARRÉ


-- ============================================================================
-- PASO 2: ELIMINAR factura F-2026-1776683752774 (EDUARDO DIMAS)
-- ============================================================================

DO $$
DECLARE
    v_invoice_id TEXT;
BEGIN
    SELECT i.id INTO v_invoice_id
    FROM "Invoice" i
    WHERE i."invoiceNumber" = 'F-2026-1776683752774'
    LIMIT 1;

    IF v_invoice_id IS NULL THEN
        RAISE EXCEPTION 'ABORTADO: No se encontró la factura F-2026-1776683752774. Verifica el número exacto.';
    END IF;

    -- Desligar de pagos asociados
    UPDATE "Payment"
    SET "invoiceId" = NULL
    WHERE "invoiceId" = v_invoice_id;

    -- Eliminar líneas de factura
    DELETE FROM "InvoiceItem"
    WHERE "invoiceId" = v_invoice_id;

    -- Eliminar la factura
    DELETE FROM "Invoice"
    WHERE id = v_invoice_id;

    RAISE NOTICE '✅ Factura F-2026-1776683752774 eliminada correctamente (id: %).', v_invoice_id;
END $$;


-- ============================================================================
-- PASO 3: ELIMINAR factura IMP-1-0 (MARC CABRERIZO FARRÉ)
-- ============================================================================

DO $$
DECLARE
    v_invoice_id TEXT;
BEGIN
    SELECT i.id INTO v_invoice_id
    FROM "Invoice" i
    JOIN "Patient" p ON p.id = i."patientId"
    WHERE i."invoiceNumber" = 'IMP-1-0'
      AND p.name ILIKE '%CABRERIZO%'
    LIMIT 1;

    IF v_invoice_id IS NULL THEN
        -- Intentar sin filtro de paciente por si el nombre difiere
        SELECT id INTO v_invoice_id
        FROM "Invoice"
        WHERE "invoiceNumber" = 'IMP-1-0'
        LIMIT 1;
    END IF;

    IF v_invoice_id IS NULL THEN
        RAISE EXCEPTION 'ABORTADO: No se encontró la factura IMP-1-0. Puede que ya haya sido eliminada anteriormente.';
    END IF;

    -- Desligar de pagos asociados
    UPDATE "Payment"
    SET "invoiceId" = NULL
    WHERE "invoiceId" = v_invoice_id;

    -- Eliminar líneas de factura
    DELETE FROM "InvoiceItem"
    WHERE "invoiceId" = v_invoice_id;

    -- Eliminar la factura
    DELETE FROM "Invoice"
    WHERE id = v_invoice_id;

    RAISE NOTICE '✅ Factura IMP-1-0 eliminada correctamente (id: %).', v_invoice_id;
END $$;


-- ============================================================================
-- PASO 4: RESUMEN DEL DÍA 20/04/2026 tras las eliminaciones
-- (Revisar los totales antes de cerrar)
-- ============================================================================

-- Ingresos
SELECT
    '2026-04-20'::date                                                      AS fecha,
    COUNT(*)                                                                AS num_facturas,
    COALESCE(SUM(amount), 0)                                                AS total_ingresos,
    COALESCE(SUM(amount) FILTER (WHERE "paymentMethod" = 'cash'),    0)     AS efectivo,
    COALESCE(SUM(amount) FILTER (WHERE "paymentMethod" = 'card'),    0)     AS tarjeta,
    COALESCE(SUM(amount) FILTER (WHERE "paymentMethod" = 'transfer'),0)     AS transferencia
FROM "Invoice"
WHERE date::date = '2026-04-20'
  AND status != 'rectified';

-- Gastos
SELECT
    COALESCE(SUM(amount), 0)                                                AS total_gastos,
    COALESCE(SUM(amount) FILTER (WHERE "paymentMethod" = 'cash'), 0)        AS gastos_efectivo
FROM expenses
WHERE date = '2026-04-20'::date;


-- ============================================================================
-- PASO 5: REGISTRAR CIERRE DE CAJA 20/04/2026
-- ============================================================================
-- Ejecutar solo tras revisar y confirmar los totales en PASO 4.

DO $$
DECLARE
    v_date              TEXT    := '2026-04-20';   -- TEXT porque cash_register_closings.date es TEXT
    v_total_income      NUMERIC;
    v_total_expense     NUMERIC;
    v_cash_income       NUMERIC;
    v_card_income       NUMERIC;
    v_transfer_income   NUMERIC;
    v_cash_expenses     NUMERIC;
    v_net_cash          NUMERIC;
    v_invoice_count     INT;
    v_id                TEXT    := gen_random_uuid()::TEXT;
BEGIN
    -- Evitar doble cierre (date es TEXT en cash_register_closings)
    IF EXISTS (SELECT 1 FROM cash_register_closings WHERE date = v_date) THEN
        RAISE EXCEPTION 'Ya existe un cierre de caja para el día %.', v_date;
    END IF;

    -- Calcular ingresos desde facturas (excluye rectificadas)
    SELECT
        COALESCE(SUM(amount), 0),
        COALESCE(SUM(amount) FILTER (WHERE "paymentMethod" = 'cash'),    0),
        COALESCE(SUM(amount) FILTER (WHERE "paymentMethod" = 'card'),    0),
        COALESCE(SUM(amount) FILTER (WHERE "paymentMethod" = 'transfer'),0),
        COUNT(*)
    INTO v_total_income, v_cash_income, v_card_income, v_transfer_income, v_invoice_count
    FROM "Invoice"
    WHERE date::date = v_date::date
      AND status != 'rectified';

    -- Calcular gastos
    SELECT
        COALESCE(SUM(amount), 0),
        COALESCE(SUM(amount) FILTER (WHERE "paymentMethod" = 'cash'), 0)
    INTO v_total_expense, v_cash_expenses
    FROM expenses
    WHERE date = v_date::date;

    v_net_cash := v_cash_income - v_cash_expenses;

    -- Insertar cierre (date como TEXT)
    INSERT INTO cash_register_closings (
        id, date, "closedAt", "closedBy",
        "totalIncome", "totalExpense", balance,
        "cashIncome", "cardIncome", "transferIncome",
        "cashExpenses", "netCash",
        "physicalCash", "cashDiff",
        "invoiceCount", "completedAppointments"
    ) VALUES (
        v_id, v_date, NOW(), 'Sistema (SQL manual)',
        v_total_income, v_total_expense, v_total_income - v_total_expense,
        v_cash_income, v_card_income, v_transfer_income,
        v_cash_expenses, v_net_cash,
        v_net_cash, 0,   -- physicalCash = efectivo calculado; cashDiff = 0
        v_invoice_count, 0
    );

    RAISE NOTICE '✅ Caja cerrada para %: ingresos=%, gastos=%, balance=%, facturas=%',
        v_date, v_total_income, v_total_expense,
        v_total_income - v_total_expense, v_invoice_count;
END $$;


-- ============================================================================
-- PASO 6: VERIFICACIÓN FINAL — debe mostrar el registro del cierre
-- ============================================================================

SELECT
    date,
    "closedAt",
    "closedBy",
    "totalIncome",
    "totalExpense",
    balance,
    "cashIncome",
    "cardIncome",
    "transferIncome",
    "invoiceCount"
FROM cash_register_closings
WHERE date = '2026-04-20';
