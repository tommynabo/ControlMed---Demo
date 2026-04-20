-- ============================================================
-- MIGRACIÓN: Añadir campo de descuento a presupuestos
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- Campo de descuento por línea (porcentaje, ej: 10 = 10%)
ALTER TABLE "BudgetLineItem"
  ADD COLUMN IF NOT EXISTS discount FLOAT DEFAULT 0;

-- Precio original antes de aplicar el descuento
ALTER TABLE "BudgetLineItem"
  ADD COLUMN IF NOT EXISTS "originalPrice" FLOAT;

-- Descuento global del presupuesto (porcentaje)
ALTER TABLE "Budget"
  ADD COLUMN IF NOT EXISTS "globalDiscount" FLOAT DEFAULT 0;

-- ============================================================
-- VERIFICACIÓN
-- ============================================================
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'BudgetLineItem'
  AND column_name IN ('discount', 'originalPrice')
  AND table_schema = 'public';

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'Budget'
  AND column_name = 'globalDiscount'
  AND table_schema = 'public';
