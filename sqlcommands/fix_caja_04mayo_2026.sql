-- ============================================================================
-- CORRECCIÓN CAJA DEL DÍA — 04/05/2026
-- ============================================================================
--
-- PROBLEMA:
--   La caja del 05/05/2026 muestra un arrastre (caja inicial) de 885,74€
--   cuando debería mostrar 25,74€.
--
--   CAUSA REAL: La caja del 04/05/2026 NUNCA fue cerrada formalmente,
--   por lo que no existe ningún registro en cash_register_closings para ese día.
--   El arrastre de 885,74€ viene del último cierre anterior al 04/05 que
--   tenía ese physicalCash incorrecto almacenado.
--
-- SOLUCIÓN:
--   1. Insertar el cierre retroactivo del 04/05 con physicalCash = 25,74€
--      calculando los ingresos reales desde la tabla Payment.
--   2. Si ya existe un cierre para 05/05, corregir su openingCash a 25,74€.
--
-- ⚠️  Ejecutar en orden. Confirmar PASO 1 y 2 antes de ejecutar PASO 3.
-- ============================================================================


-- ============================================================================
-- PASO 1: VERIFICAR el estado actual — ver los últimos 7 cierres registrados
-- ============================================================================

SELECT
    date,
    "openingCash"                                                AS arrastre_entrada,
    "cashIncome"                                                 AS ingresos_efectivo,
    "cashExpenses"                                               AS gastos_efectivo,
    ("openingCash" + "cashIncome" - "cashExpenses")              AS efectivo_esperado,
    "physicalCash"                                               AS efectivo_fisico_arqueo,
    "cashDiff"                                                   AS diferencia,
    "closedAt",
    "closedBy"
FROM cash_register_closings
ORDER BY date DESC
LIMIT 7;

-- Verifica que NO aparece ninguna fila para '2026-05-04' → eso confirma que
-- la caja de ese día quedó sin cerrar.
-- También identifica de qué día viene el physicalCash = 885,74€.


-- ============================================================================
-- PASO 2: COMPROBAR los ingresos reales del 04/05/2026
--         (estos valores serán usados para insertar el cierre retroactivo)
-- ============================================================================

SELECT
    COALESCE(SUM(CASE WHEN method = 'CASH'     THEN amount ELSE 0 END), 0)  AS cash_income,
    COALESCE(SUM(CASE WHEN method = 'CARD'     THEN amount ELSE 0 END), 0)  AS card_income,
    COALESCE(SUM(CASE WHEN method = 'TRANSFER' THEN amount ELSE 0 END), 0)  AS transfer_income,
    COALESCE(SUM(amount), 0)                                                 AS total_income,
    COUNT(*)                                                                 AS num_cobros
FROM "Payment"
WHERE "createdAt"::date = '2026-05-04';

-- Confirma que los importes tienen sentido antes de continuar.


-- ============================================================================
-- PASO 3: INSERTAR el cierre retroactivo del 04/05/2026
--         y corregir el openingCash del 05/05/2026 si ya está cerrado
-- ============================================================================

DO $$
DECLARE
    v_id                TEXT;
    v_prev_physical     NUMERIC;
    v_cash_income       NUMERIC;
    v_card_income       NUMERIC;
    v_transfer_income   NUMERIC;
    v_total_income      NUMERIC;
    v_cash_expenses     NUMERIC := 0;  -- Sin gastos registrados ese día
    v_net_cash          NUMERIC;
    v_expected_cash     NUMERIC;
    v_cash_diff         NUMERIC;
    v_physical_cash     CONSTANT NUMERIC := 25.74;
    v_existing          RECORD;
BEGIN
    -- -------------------------------------------------------------------------
    -- 0. Comprobar si ya existe un cierre para 04/05 (por si se ejecuta dos veces)
    -- -------------------------------------------------------------------------
    SELECT id INTO v_existing
    FROM cash_register_closings
    WHERE date = '2026-05-04'
    LIMIT 1;

    IF v_existing.id IS NOT NULL THEN
        RAISE NOTICE 'ℹ️  Ya existe un cierre para 04/05/2026 (id: %). Saltando inserción.', v_existing.id;
    ELSE
        -- 1. Obtener el arrastre de entrada para 04/05:
        --    physicalCash del último cierre anterior al 04/05
        SELECT COALESCE("physicalCash", 0)
        INTO v_prev_physical
        FROM cash_register_closings
        WHERE date < '2026-05-04'
        ORDER BY date DESC
        LIMIT 1;
        v_prev_physical := COALESCE(v_prev_physical, 0);
        RAISE NOTICE 'Arrastre de entrada para 04/05: %€', v_prev_physical;

        -- 2. Calcular ingresos reales del 04/05 desde Payment
        SELECT
            COALESCE(SUM(CASE WHEN method = 'CASH'     THEN amount ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN method = 'CARD'     THEN amount ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN method = 'TRANSFER' THEN amount ELSE 0 END), 0),
            COALESCE(SUM(amount), 0)
        INTO v_cash_income, v_card_income, v_transfer_income, v_total_income
        FROM "Payment"
        WHERE "createdAt"::date = '2026-05-04';

        RAISE NOTICE 'Ingresos 04/05 → Cash: %€  Card: %€  Transfer: %€  Total: %€',
            v_cash_income, v_card_income, v_transfer_income, v_total_income;

        -- 3. Derivar valores de caja
        v_net_cash      := v_cash_income - v_cash_expenses;
        v_expected_cash := v_prev_physical + v_net_cash;
        v_cash_diff     := v_physical_cash - v_expected_cash;

        RAISE NOTICE 'Efectivo esperado: %€  |  physicalCash fijado: %€  |  cashDiff: %€',
            v_expected_cash, v_physical_cash, v_cash_diff;

        -- 4. Insertar el cierre retroactivo
        v_id := gen_random_uuid()::text;
        INSERT INTO cash_register_closings (
            id, date, "closedAt", "closedBy",
            "totalIncome", "totalExpense", balance,
            "cashIncome", "cardIncome", "transferIncome",
            "cashExpenses", "netCash", "physicalCash", "cashDiff",
            "invoiceCount", "completedAppointments", "openingCash"
        ) VALUES (
            v_id, '2026-05-04', NOW(), 'CORRECCIÓN MANUAL',
            v_total_income, 0, v_total_income,
            v_cash_income, v_card_income, v_transfer_income,
            v_cash_expenses, v_net_cash, v_physical_cash, v_cash_diff,
            0, 0, v_prev_physical
        );

        RAISE NOTICE '✅ Cierre del 04/05/2026 insertado correctamente. physicalCash = 25,74€';
    END IF;

    -- -------------------------------------------------------------------------
    -- 5. Corregir openingCash del 05/05/2026 si ya existe y es incorrecto
    -- -------------------------------------------------------------------------
    SELECT id INTO v_existing
    FROM cash_register_closings
    WHERE date = '2026-05-05'
    LIMIT 1;

    IF v_existing.id IS NOT NULL THEN
        UPDATE cash_register_closings
        SET "openingCash" = v_physical_cash
        WHERE date = '2026-05-05';
        RAISE NOTICE '✅ openingCash del 05/05/2026 corregido a 25,74€';
    ELSE
        RAISE NOTICE 'ℹ️  No existe cierre para 05/05/2026 — el arrastre se calculará automáticamente '
                     'al recargar la página de Caja del Día.';
    END IF;

END $$;


-- ============================================================================
-- PASO 4: VERIFICACIÓN FINAL
-- ============================================================================

SELECT
    date,
    "openingCash"                                                AS arrastre_entrada,
    "cashIncome"                                                 AS ingresos_efectivo,
    ("openingCash" + "cashIncome" - "cashExpenses")              AS efectivo_esperado,
    "physicalCash"                                               AS efectivo_fisico_arqueo,
    "cashDiff"                                                   AS diferencia,
    "closedBy"
FROM cash_register_closings
WHERE date IN ('2026-05-03', '2026-05-04', '2026-05-05')
ORDER BY date;

-- Resultado esperado:
--   04/05 → physicalCash = 25,74€, closedBy = 'CORRECCIÓN MANUAL'  ✅
--   05/05 → openingCash  = 25,74€ (si la fila existe)              ✅
--           (Si 05/05 aún no está cerrado, recarga la página de Caja
--            del Día y verás el arrastre correcto de 25,74€)
