-- ============================================================
-- MIGRACIÓN: Añadir campos de descuento y comisión globales
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- Descuento global del presupuesto (porcentaje, visible al paciente)
ALTER TABLE "Budget"
  ADD COLUMN IF NOT EXISTS "discountPercent" FLOAT DEFAULT 0;

-- Comisión global del presupuesto (porcentaje, oculta al paciente)
ALTER TABLE "Budget"
  ADD COLUMN IF NOT EXISTS "commissionPercent" FLOAT DEFAULT 0;

-- ============================================================
-- VERIFICACIÓN
-- ============================================================
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'Budget'
  AND column_name IN ('discountPercent', 'commissionPercent')
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Mostrar todas las columnas de Budget para verificación
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'Budget'
  AND table_schema = 'public'
ORDER BY ordinal_position;
