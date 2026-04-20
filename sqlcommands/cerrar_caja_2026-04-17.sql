-- ============================================================================
-- CIERRE DE CAJA: 17/04/2026 (día anterior, no cerrado)
-- ============================================================================
--
-- INSTRUCCIONES:
--   1. Ejecutar PASO 1 para ver el resumen de ingresos y gastos del día.
--   2. Revisar los totales y confirmar que son correctos.
--   3. Ejecutar PASO 2 para registrar el cierre oficialmente.
--   4. Ejecutar PASO 3 para verificar que el cierre quedó guardado.
--
-- NOTA: El campo "physicalCash" (efectivo físico contado) se pone igual al
--       efectivo calculado (sin diferencia). Si se contó físicamente otro
--       importe, ajustar el valor en PASO 2 antes de ejecutar.
-- ============================================================================


-- ============================================================================
-- PASO 1: RESUMEN DEL DÍA — verifica ingresos, gastos y desglose por método
-- ============================================================================

SELECT
    '2026-04-17'::date                                                  AS fecha,
    COUNT(*)                                                            AS num_facturas,
    COALESCE(SUM(amount), 0)                                            AS total_ingresos,
    COALESCE(SUM(amount) FILTER (WHERE "paymentMethod" = 'cash'),   0)  AS efectivo,
    COALESCE(SUM(amount) FILTER (WHERE "paymentMethod" = 'card'),   0)  AS tarjeta,
    COALESCE(SUM(amount) FILTER (WHERE "paymentMethod" = 'transfer'),0) AS transferencia
FROM "Invoice"
WHERE date::date = '2026-04-17'
  AND status != 'rectified';

-- Gastos del día
SELECT
    COALESCE(SUM(amount), 0)                                            AS total_gastos,
    COALESCE(SUM(amount) FILTER (WHERE "paymentMethod" = 'cash'), 0)    AS gastos_efectivo
FROM expenses
WHERE date = '2026-04-17'::date;


-- ============================================================================
-- PASO 2: REGISTRAR CIERRE DE CAJA
-- ============================================================================
-- Ejecutar solo tras revisar los totales en PASO 1.

DO $$
DECLARE
    v_date              DATE    := '2026-04-17'::date;
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
    -- Verificar que no existe ya un cierre para ese día
    IF EXISTS (SELECT 1 FROM cash_register_closings WHERE date = v_date) THEN
        RAISE EXCEPTION 'Ya existe un cierre de caja para el día %.', v_date;
    END IF;

    -- Calcular ingresos desde facturas
    SELECT
        COALESCE(SUM(amount), 0),
        COALESCE(SUM(amount) FILTER (WHERE "paymentMethod" = 'cash'),    0),
        COALESCE(SUM(amount) FILTER (WHERE "paymentMethod" = 'card'),    0),
        COALESCE(SUM(amount) FILTER (WHERE "paymentMethod" = 'transfer'),0),
        COUNT(*)
    INTO v_total_income, v_cash_income, v_card_income, v_transfer_income, v_invoice_count
    FROM "Invoice"
    WHERE date::date = v_date
      AND status != 'rectified';

    -- Calcular gastos desde expenses
    SELECT
        COALESCE(SUM(amount), 0),
        COALESCE(SUM(amount) FILTER (WHERE "paymentMethod" = 'cash'), 0)
    INTO v_total_expense, v_cash_expenses
    FROM expenses
    WHERE date = v_date;

    v_net_cash := v_cash_income - v_cash_expenses;

    INSERT INTO cash_register_closings (
        id, date, "closedAt", "closedBy",
        "totalIncome", "totalExpense", balance,
        "cashIncome", "cardIncome", "transferIncome",
        "cashExpenses", "netCash",
        "physicalCash", "cashDiff",
        "invoiceCount", "completedAppointments"
    ) VALUES (
        v_id,
        v_date,
        NOW(),
        'Admin (cierre manual retroactivo)',
        v_total_income,
        v_total_expense,
        v_total_income - v_total_expense,
        v_cash_income,
        v_card_income,
        v_transfer_income,
        v_cash_expenses,
        v_net_cash,
        v_net_cash,   -- physicalCash = netCash (sin diferencia; ajustar si se contó)
        0,            -- cashDiff = 0
        v_invoice_count,
        0             -- completedAppointments (no disponible retroactivamente)
    );

    RAISE NOTICE '✅ Cierre de caja registrado para % — Ingresos: % € | Gastos: % € | Neto: % €',
        v_date, v_total_income, v_total_expense, v_total_income - v_total_expense;
END $$;


-- ============================================================================
-- PASO 3: VERIFICACIÓN POST — debe mostrar el registro del cierre
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
WHERE date = '2026-04-17'::date;
