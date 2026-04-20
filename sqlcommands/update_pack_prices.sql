-- ============================================================
-- UPDATE PACK PRICES - ABRIL 2026
--
-- Cambios:
-- 1. Actualizar precios de servicios individuales para packs
-- 2. Crear dos nuevos packs con precios diferentes
-- 3. Mantener servicios antiguos para compatibilidad
--
-- ⚠️ EJECUTAR DESPUÉS DE REVISAR LOS PRECIOS
-- ============================================================

-- PASO 1: Actualizar servicios individuales
-- srv-11: Primera visita (0€ → 20€)
UPDATE services 
SET final_price = 20, base_price = 20
WHERE name = 'Primera visita';

-- srv-12: OPG (30€ → 10€ para Pack 1a)
-- Nota: Este precio es base; se puede sobrescribir por pack
UPDATE services 
SET final_price = 10, base_price = 10
WHERE name = 'OPG';

-- srv-13: Tartrectomía (50€ → 0€, excluido de Pack 1b)
UPDATE services 
SET final_price = 0, base_price = 0
WHERE name = 'Tartrectomía';

-- PASO 2: Crear nuevo servicio "Higiene" si no existe
INSERT INTO services (name, specialty_name, base_price, discount_percent, tax_percent, final_price, duration_min, is_active, created_at, updated_at)
SELECT 'Higiene', 'General', 30, 0, 0, 30, 30, true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM services WHERE name = 'Higiene');

-- PASO 3: Actualizar o crear Pack 1a (60€: 1ª visita 20€ + OPG 10€ + Higiene 30€)
INSERT INTO services (name, specialty_name, base_price, discount_percent, tax_percent, final_price, duration_min, is_active, created_at, updated_at)
SELECT 'Pack 1ª Visita: 1ª Consulta + OPG + Higiene', 'General', 60, 0, 0, 60, 90, true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM services WHERE name = 'Pack 1ª Visita: 1ª Consulta + OPG + Higiene');

UPDATE services SET final_price = 60, base_price = 60, updated_at = NOW()
WHERE name = 'Pack 1ª Visita: 1ª Consulta + OPG + Higiene';

-- PASO 4: Crear Pack 1b (45€: 1ª visita 25€ + OPG 20€)
INSERT INTO services (name, specialty_name, base_price, discount_percent, tax_percent, final_price, duration_min, is_active, created_at, updated_at)
SELECT 'Pack 1ª Visita: 1ª Consulta + OPG', 'General', 45, 0, 0, 45, 60, true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM services WHERE name = 'Pack 1ª Visita: 1ª Consulta + OPG');

UPDATE services SET final_price = 45, base_price = 45, updated_at = NOW()
WHERE name = 'Pack 1ª Visita: 1ª Consulta + OPG';

-- PASO 5: Verificación - Ver servicios actualizados
SELECT name, final_price, base_price, is_active
FROM services
WHERE name IN (
  'Primera visita',
  'OPG',
  'Tartrectomía',
  'Higiene',
  'Pack 1ª Visita: 1ª Consulta + OPG + Higiene',
  'Pack 1ª Visita: 1ª Consulta + OPG'
)
ORDER BY name;
