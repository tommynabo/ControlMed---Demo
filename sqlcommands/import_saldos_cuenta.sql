-- ============================================================================
-- IMPORTAR SALDOS A CUENTA (MONEDERO) DESDE SISTEMA ANTIGUO
-- Origen: DatosCompletosClinica/apunte_cuenta_1.csv
-- Calculados como saldo neto (entradas - salidas) por paciente
--
-- Pacientes con saldo > 0:
--   Mª LUZ GARCIA LUBIAN   (DNI: 11758370B) → 3959.00 €
--   RITA GARCIA CELEIRO    (DNI: 76599346P) → 255.60 €
--   MARIA FERNANDA POLO    (DNI: 60125266T) → 433.80 €
--   MARCO PIRAS            (DNI: Y6644426Q) → 605.00 €
--   EDUARDO GEGA ZAMBALE   (DNI: 46988593F) → 2779.26 €
--
-- Pacientes con saldo 0 (no se insertan): CHANEL CAVALLARO, 
--   LADISLAO AVILERO, ANA ALONSO, RAMON CASTELLA
--
-- INSTRUCCIONES:
--   1. Ejecutar en Supabase → SQL Editor
--   2. Primero PASO 1 (verificación) para confirmar que los pacientes existen
--   3. Luego PASO 2 (importación)
--   4. Finalmente PASO 3 (verificación post)
-- ============================================================================


-- ============================================================================
-- PASO 1: VERIFICACIÓN — confirma que los pacientes existen por DNI
-- ============================================================================

SELECT id, name, dni, wallet
FROM "Patient"
WHERE dni ILIKE ANY(ARRAY['11758370B','76599346P','60125266T','Y6644426Q','46988593F'])
ORDER BY name;


-- ============================================================================
-- PASO 2: IMPORTACIÓN
-- ============================================================================

DO $$
DECLARE
    v_patient_id TEXT;
    v_count      INT := 0;
BEGIN

    -- ── Mª LUZ GARCIA LUBIAN — 3959.00 € ─────────────────────────────────
    SELECT id INTO v_patient_id FROM "Patient"
    WHERE dni ILIKE '11758370B' LIMIT 1;

    IF v_patient_id IS NULL THEN
        RAISE NOTICE 'AVISO: No se encontró paciente con DNI 11758370B (Mª Luz García Lubián). Omitida.';
    ELSE
        -- Evitar duplicado: solo insertar si no existe ya un pago de migración
        IF NOT EXISTS (
            SELECT 1 FROM "Payment"
            WHERE "patientId" = v_patient_id
              AND type = 'ADVANCE_PAYMENT'
              AND notes LIKE '%Saldo migrado%'
        ) THEN
            INSERT INTO "Payment" (id, "patientId", amount, method, type, notes, "createdAt")
            VALUES (
                gen_random_uuid(),
                v_patient_id,
                3959.00,
                'transfer',
                'ADVANCE_PAYMENT',
                'Saldo migrado desde sistema anterior (neto acumulado)',
                '2025-03-24T12:00:00Z'
            );
            UPDATE "Patient" SET wallet = 3959.00 WHERE id = v_patient_id;
            v_count := v_count + 1;
            RAISE NOTICE 'OK: Mª Luz García Lubián → 3959.00 €';
        ELSE
            RAISE NOTICE 'OMITIDO: Mª Luz García Lubián ya tiene pago de migración.';
        END IF;
    END IF;

    -- ── RITA GARCIA CELEIRO — 255.60 € ───────────────────────────────────
    SELECT id INTO v_patient_id FROM "Patient"
    WHERE dni ILIKE '76599346P' LIMIT 1;

    IF v_patient_id IS NULL THEN
        RAISE NOTICE 'AVISO: No se encontró paciente con DNI 76599346P (Rita García Celeiro). Omitida.';
    ELSE
        IF NOT EXISTS (
            SELECT 1 FROM "Payment"
            WHERE "patientId" = v_patient_id
              AND type = 'ADVANCE_PAYMENT'
              AND notes LIKE '%Saldo migrado%'
        ) THEN
            INSERT INTO "Payment" (id, "patientId", amount, method, type, notes, "createdAt")
            VALUES (
                gen_random_uuid(),
                v_patient_id,
                255.60,
                'transfer',
                'ADVANCE_PAYMENT',
                'Saldo migrado desde sistema anterior (neto acumulado)',
                '2025-03-24T12:00:00Z'
            );
            UPDATE "Patient" SET wallet = 255.60 WHERE id = v_patient_id;
            v_count := v_count + 1;
            RAISE NOTICE 'OK: Rita García Celeiro → 255.60 €';
        ELSE
            RAISE NOTICE 'OMITIDO: Rita García Celeiro ya tiene pago de migración.';
        END IF;
    END IF;

    -- ── MARIA FERNANDA POLO — 433.80 € ───────────────────────────────────
    SELECT id INTO v_patient_id FROM "Patient"
    WHERE dni ILIKE '60125266T' LIMIT 1;

    IF v_patient_id IS NULL THEN
        RAISE NOTICE 'AVISO: No se encontró paciente con DNI 60125266T (Maria Fernanda Polo). Omitida.';
    ELSE
        IF NOT EXISTS (
            SELECT 1 FROM "Payment"
            WHERE "patientId" = v_patient_id
              AND type = 'ADVANCE_PAYMENT'
              AND notes LIKE '%Saldo migrado%'
        ) THEN
            INSERT INTO "Payment" (id, "patientId", amount, method, type, notes, "createdAt")
            VALUES (
                gen_random_uuid(),
                v_patient_id,
                433.80,
                'transfer',
                'ADVANCE_PAYMENT',
                'Saldo migrado desde sistema anterior (neto acumulado)',
                '2025-03-24T12:00:00Z'
            );
            UPDATE "Patient" SET wallet = 433.80 WHERE id = v_patient_id;
            v_count := v_count + 1;
            RAISE NOTICE 'OK: Maria Fernanda Polo → 433.80 €';
        ELSE
            RAISE NOTICE 'OMITIDO: Maria Fernanda Polo ya tiene pago de migración.';
        END IF;
    END IF;

    -- ── MARCO PIRAS — 605.00 € ────────────────────────────────────────────
    SELECT id INTO v_patient_id FROM "Patient"
    WHERE dni ILIKE 'Y6644426Q' LIMIT 1;

    IF v_patient_id IS NULL THEN
        RAISE NOTICE 'AVISO: No se encontró paciente con DNI Y6644426Q (Marco Piras). Omitido.';
    ELSE
        IF NOT EXISTS (
            SELECT 1 FROM "Payment"
            WHERE "patientId" = v_patient_id
              AND type = 'ADVANCE_PAYMENT'
              AND notes LIKE '%Saldo migrado%'
        ) THEN
            INSERT INTO "Payment" (id, "patientId", amount, method, type, notes, "createdAt")
            VALUES (
                gen_random_uuid(),
                v_patient_id,
                605.00,
                'transfer',
                'ADVANCE_PAYMENT',
                'Saldo migrado desde sistema anterior (neto acumulado)',
                '2025-03-24T12:00:00Z'
            );
            UPDATE "Patient" SET wallet = 605.00 WHERE id = v_patient_id;
            v_count := v_count + 1;
            RAISE NOTICE 'OK: Marco Piras → 605.00 €';
        ELSE
            RAISE NOTICE 'OMITIDO: Marco Piras ya tiene pago de migración.';
        END IF;
    END IF;

    -- ── EDUARDO GEGA ZAMBALE — 2779.26 € ─────────────────────────────────
    SELECT id INTO v_patient_id FROM "Patient"
    WHERE dni ILIKE '46988593F' LIMIT 1;

    IF v_patient_id IS NULL THEN
        RAISE NOTICE 'AVISO: No se encontró paciente con DNI 46988593F (Eduardo Gega Zambale). Omitido.';
    ELSE
        IF NOT EXISTS (
            SELECT 1 FROM "Payment"
            WHERE "patientId" = v_patient_id
              AND type = 'ADVANCE_PAYMENT'
              AND notes LIKE '%Saldo migrado%'
        ) THEN
            INSERT INTO "Payment" (id, "patientId", amount, method, type, notes, "createdAt")
            VALUES (
                gen_random_uuid(),
                v_patient_id,
                2779.26,
                'transfer',
                'ADVANCE_PAYMENT',
                'Saldo migrado desde sistema anterior (neto acumulado)',
                '2025-03-24T12:00:00Z'
            );
            UPDATE "Patient" SET wallet = 2779.26 WHERE id = v_patient_id;
            v_count := v_count + 1;
            RAISE NOTICE 'OK: Eduardo Gega Zambale → 2779.26 €';
        ELSE
            RAISE NOTICE 'OMITIDO: Eduardo Gega Zambale ya tiene pago de migración.';
        END IF;
    END IF;

    RAISE NOTICE '✅ COMPLETADO: % saldos importados.', v_count;

END $$;


-- ============================================================================
-- PASO 3: VERIFICACIÓN POST — debe mostrar los 5 pacientes con saldo correcto
-- ============================================================================

SELECT p.name, p.dni, p.wallet AS wallet_campo,
       COALESCE(SUM(pm.amount), 0) AS total_pagos_advance
FROM "Patient" p
LEFT JOIN "Payment" pm ON pm."patientId" = p.id AND pm.type = 'ADVANCE_PAYMENT'
WHERE p.dni ILIKE ANY(ARRAY['11758370B','76599346P','60125266T','Y6644426Q','46988593F'])
GROUP BY p.id, p.name, p.dni, p.wallet
ORDER BY p.name;
