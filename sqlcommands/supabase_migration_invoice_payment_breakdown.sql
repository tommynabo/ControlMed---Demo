-- ============================================================================
-- MIGRACIÓN: Añadir paymentBreakdown a la tabla Invoice
-- ============================================================================
-- Propósito:
--   Almacena el desglose de métodos de pago de una factura consolidada.
--   Formato JSON: [{"method": "cash", "amount": 20}, {"method": "card", "amount": 40}]
--
--   Solo se rellena cuando una cita se ha pagado en dos o más entregas
--   con métodos distintos.
--
-- ⚠️  Ejecutar en Supabase → SQL Editor antes de desplegar el backend.
-- ============================================================================

-- 1. Añadir la columna JSONB nullable
ALTER TABLE "Invoice"
  ADD COLUMN IF NOT EXISTS "paymentBreakdown" JSONB;

-- 2. Verificación: muestra las últimas 5 facturas con la nueva columna
SELECT id, "invoiceNumber", amount, "paymentMethod", "paymentBreakdown", "appointmentId"
FROM "Invoice"
ORDER BY date DESC
LIMIT 5;
