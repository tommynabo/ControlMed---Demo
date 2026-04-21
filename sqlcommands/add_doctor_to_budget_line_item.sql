-- ============================================================================
-- MIGRACIÓN: Añadir doctorId a BudgetLineItem
-- ============================================================================
--
-- Permite asignar un doctor distinto a cada línea de tratamiento dentro de
-- un presupuesto. Esto es necesario para los casos en que dos doctores realizan
-- tratamientos distintos en la misma cita (ej. Dr. Ro → reconstrucciones /
-- Dr. Kevin → extracciones).
--
-- IMPACTO EN LIQUIDACIONES:
--   La asignación de doctor para el cálculo de comisiones sigue haciéndose a
--   nivel de cita (Appointment.doctorId). Este campo en BudgetLineItem es solo
--   informativo y de referencia para recepción. Antes de cerrar una liquidación
--   mensual, recepción debe corregir el doctor en la cita usando el modal de
--   reasignación existente.
--
-- INSTRUCCIONES:
--   1. Ejecutar este script en Supabase SQL Editor (o pgAdmin).
--   2. Ejecutar: npx prisma db pull  (para actualizar el schema Prisma)
--      O bien: actualizar manualmente server/prisma/schema.prisma (ver todo #6).
-- ============================================================================

ALTER TABLE "BudgetLineItem"
ADD COLUMN IF NOT EXISTS "doctorId" TEXT REFERENCES "Doctor"("id") ON DELETE SET NULL;

-- Índice para acelerar búsquedas por doctor
CREATE INDEX IF NOT EXISTS "BudgetLineItem_doctorId_idx"
    ON "BudgetLineItem" ("doctorId");

-- Verificación
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'BudgetLineItem'
  AND column_name = 'doctorId';
-- Resultado esperado: 1 fila con data_type = 'text' y is_nullable = 'YES'
