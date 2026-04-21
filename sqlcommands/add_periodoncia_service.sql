-- ============================================================================
-- NUEVO CONCEPTO/TRATAMIENTO: PERIODONCIA
-- Nombre  : PERIODONCIA - TRATAMIENTO NO QUIRÚRGICO DE LA PERIIMPLANTITIS
-- Importe : 115 €
-- Duración: 60 min
-- ============================================================================

-- PASO 1: Insertar el nuevo tratamiento
INSERT INTO public.services (
    name,
    specialty_name,
    specialty_color,
    base_price,
    final_price,
    discount_percent,
    tax_percent,
    duration_min,
    is_active,
    created_at,
    updated_at
)
VALUES (
    'PERIODONCIA - TRATAMIENTO NO QUIRÚRGICO DE LA PERIIMPLANTITIS',
    'Periodoncia',
    '#8b5a8f',
    115.00,
    115.00,
    0,
    0,
    60,
    TRUE,
    NOW(),
    NOW()
);

-- PASO 2: Verificar resultado
SELECT
    id,
    name,
    specialty_name,
    final_price,
    duration_min,
    is_active
FROM public.services
WHERE name ILIKE '%periimplantitis%'
ORDER BY name;

-- Resultado esperado: 1 fila con final_price = 115.00, duration_min = 60, is_active = true
