-- ============================================================================
-- MIGRACIÓN: Añadir columna openingCash a cash_register_closings
-- ============================================================================
--
-- Esta columna almacena el efectivo inicial (arrastre) de cada día:
-- el valor del physicalCash del cierre del día anterior se copia aquí
-- automáticamente cuando se cierra la caja.
--
-- INSTRUCCIONES:
--   1. Ejecutar PASO 1 para añadir la columna.
--   2. Ejecutar PASO 2 para rellenar retroactivamente los registros existentes.
--   3. Ejecutar PASO 3 para verificar el resultado.
-- ============================================================================


-- ============================================================================
-- PASO 1: Añadir la columna openingCash
-- ============================================================================

ALTER TABLE cash_register_closings
ADD COLUMN IF NOT EXISTS "openingCash" FLOAT DEFAULT 0;


-- ============================================================================
-- PASO 2: Rellenar retroactivamente los cierres existentes
-- Cada día recibe el physicalCash del día anterior como openingCash.
-- ============================================================================

UPDATE cash_register_closings c
SET "openingCash" = (
    SELECT prev."physicalCash"
    FROM cash_register_closings prev
    WHERE prev.date < c.date
    ORDER BY prev.date DESC
    LIMIT 1
)
WHERE "openingCash" = 0 OR "openingCash" IS NULL;


-- ============================================================================
-- PASO 3: Verificación — debe mostrar todos los cierres con openingCash
-- ============================================================================

SELECT
    date,
    "openingCash",
    "cashIncome",
    "cashExpenses",
    "physicalCash",
    "cashDiff"
FROM cash_register_closings
ORDER BY date DESC
LIMIT 10;
