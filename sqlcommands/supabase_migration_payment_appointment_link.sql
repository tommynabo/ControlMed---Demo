-- ============================================================================
-- MIGRACIÓN: Añadir appointmentId a la tabla Payment
-- ============================================================================
-- Propósito:
--   Permite rastrear a qué cita pertenece cada pago (parcial o completo).
--   Esto es necesario para calcular correctamente el importe ya pagado de
--   una cita y generar una única factura consolidada al pago final.
--
-- ⚠️  Ejecutar en Supabase → SQL Editor antes de desplegar el backend.
-- ============================================================================

-- 1. Añadir la columna (nullable para no romper registros existentes)
ALTER TABLE "Payment"
  ADD COLUMN IF NOT EXISTS "appointmentId" TEXT REFERENCES "Appointment"("id") ON DELETE SET NULL;

-- 2. Índice para acelerar la consulta "dame todos los pagos de esta cita"
CREATE INDEX IF NOT EXISTS idx_payment_appointment_id
  ON "Payment" ("appointmentId");

-- 3. Verificación: muestra las últimas 5 filas con la nueva columna
SELECT id, "patientId", "appointmentId", amount, method, "createdAt"
FROM "Payment"
ORDER BY "createdAt" DESC
LIMIT 5;
