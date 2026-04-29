-- ============================================================
-- MIGRACIÓN: DESGLOSE DE PACKS + EXCLUSIÓN OPG DE LIQUIDACIONES
--
-- ⚠️  EJECUTAR EN SUPABASE SQL EDITOR
-- Ejecutar en orden: primero el ALTER TABLE de Service, luego el de Appointment
-- ============================================================

-- ── PASO 1: Añadir flag exclude_from_liquidation a la tabla Service ───────────
ALTER TABLE "Service"
ADD COLUMN IF NOT EXISTS exclude_from_liquidation BOOLEAN NOT NULL DEFAULT false;

-- Marcar OPG como servicio que va a la clínica (no al doctor)
UPDATE "Service"
SET exclude_from_liquidation = true
WHERE name ILIKE 'OPG%';

-- Verificar el resultado
SELECT id, name, exclude_from_liquidation
FROM "Service"
WHERE exclude_from_liquidation = true
   OR name ILIKE 'OPG%'
   OR name ILIKE '%primera visita%'
   OR name ILIKE 'higiene%'
   OR name ILIKE 'tartrectom%';

-- ── PASO 2: Añadir columna service_breakdown a la tabla Appointment ───────────
-- Guarda el desglose individual de servicios como JSON:
-- [{ "id": "...", "name": "OPG", "price": 10, "excludeFromLiquidation": true }, ...]
ALTER TABLE "Appointment"
ADD COLUMN IF NOT EXISTS service_breakdown JSONB;

-- Índice para consultas eficientes sobre el breakdown
CREATE INDEX IF NOT EXISTS idx_appointment_service_breakdown
    ON "Appointment" USING GIN (service_breakdown)
    WHERE service_breakdown IS NOT NULL;

-- ── PASO 3: VERIFICACIÓN ──────────────────────────────────────────────────────
-- Confirmar que las columnas existen
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'Service'
  AND column_name = 'exclude_from_liquidation';

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'Appointment'
  AND column_name = 'service_breakdown';

-- Cuántos servicios están marcados como "clínica"
SELECT COUNT(*) AS servicios_excluidos
FROM "Service"
WHERE exclude_from_liquidation = true;
