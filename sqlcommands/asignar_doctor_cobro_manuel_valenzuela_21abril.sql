-- ============================================================================
-- ASIGNAR DOCTOR "ELISSA" AL COBRO DE MANUEL VALENZUELA PEREZ — 21/04/2026
-- ============================================================================
--
-- PROBLEMA: El Payment del 21/04/2026 de Manuel Valenzuela Perez (220€, CASH)
--           no tiene doctorId asignado → aparece "—" en la caja (cobros)
--           y no computa en las liquidaciones de la Dra. Elissa.
--
-- SOLUCIÓN: Actualizar Payment.doctorId con el ID de la Dra. Elissa.
--
-- ⚠️  Ejecutar en orden. NO ejecutar PASO 2 sin confirmar PASO 1.
-- ============================================================================


-- ============================================================================
-- PASO 1A: Verificar el doctor "Elissa" en la tabla Doctor
-- ============================================================================

SELECT id AS doctor_id, name AS doctor_name
FROM "Doctor"
WHERE name ILIKE '%Elissa%'
ORDER BY name;

-- Resultado esperado: 1 fila con la Dra. Elissa y su id (UUID o texto).
-- Anota el doctor_id para confirmar que es el correcto.


-- ============================================================================
-- PASO 1B: Verificar el Payment de Manuel Valenzuela Perez del 21/04/2026
-- ============================================================================

SELECT
    p.id             AS payment_id,
    p."createdAt",
    p.amount,
    p.method,
    p.type,
    p."doctorId",
    p."invoiceId",
    pat.name         AS patient_name
FROM "Payment" p
JOIN "Patient" pat ON pat.id = p."patientId"
WHERE pat.name ILIKE '%Manuel%Valenzuela%'
ORDER BY p."createdAt" ASC;

-- Resultado esperado: 1 fila del 21/04/2026, 220€, CASH, doctorId = NULL.


-- ============================================================================
-- PASO 2: ASIGNAR el doctorId de Elissa al Payment de Manuel Valenzuela
-- ============================================================================

DO $$
DECLARE
    v_patient_id   TEXT;
    v_doctor_id    TEXT;
    v_payment_id   TEXT;
    v_payment_date TIMESTAMP;
    v_amount       FLOAT;
BEGIN
    -- 1. Obtener patientId de Manuel Valenzuela Perez
    SELECT id INTO v_patient_id
    FROM "Patient"
    WHERE name ILIKE '%Manuel%Valenzuela%'
    LIMIT 1;

    IF v_patient_id IS NULL THEN
        RAISE EXCEPTION 'ABORTADO: No se encontró al paciente Manuel Valenzuela Perez.';
    END IF;

    -- 2. Obtener doctorId de la Dra. Elissa
    SELECT id INTO v_doctor_id
    FROM "Doctor"
    WHERE name ILIKE '%Elissa%'
    LIMIT 1;

    IF v_doctor_id IS NULL THEN
        RAISE EXCEPTION 'ABORTADO: No se encontró ningún doctor con el nombre Elissa en la tabla Doctor.';
    END IF;

    -- 3. Localizar el Payment: 21/04/2026, 220€, CASH
    SELECT id, "createdAt", amount
    INTO v_payment_id, v_payment_date, v_amount
    FROM "Payment"
    WHERE "patientId" = v_patient_id
      AND "createdAt"::date = '2026-04-21'
      AND amount = 220
      AND method ILIKE 'CASH'
    ORDER BY "createdAt" ASC
    LIMIT 1;

    IF v_payment_id IS NULL THEN
        RAISE EXCEPTION 'ABORTADO: No se encontró el Payment de 220€ CASH del 21/04/2026 para Manuel Valenzuela.';
    END IF;

    RAISE NOTICE 'Payment encontrado → id: %, fecha: %, importe: %€', v_payment_id, v_payment_date, v_amount;
    RAISE NOTICE 'Doctor Elissa    → id: %', v_doctor_id;

    -- 4. Asignar el doctorId
    UPDATE "Payment"
    SET "doctorId" = v_doctor_id
    WHERE id = v_payment_id;

    RAISE NOTICE '✅ doctorId asignado correctamente.';
    RAISE NOTICE '✅ El cobro de Manuel Valenzuela ya mostrará a la Dra. Elissa en Cobros y en sus Liquidaciones.';
END $$;


-- ============================================================================
-- PASO 3: VERIFICAR que el Payment ya tiene el doctorId de Elissa
-- ============================================================================

SELECT
    p.id             AS payment_id,
    p."createdAt"::date AS fecha,
    p.amount,
    p.method,
    p."doctorId",
    d.name           AS doctor_asignado,
    pat.name         AS paciente
FROM "Payment" p
JOIN "Patient" pat ON pat.id = p."patientId"
LEFT JOIN "Doctor" d ON d.id = p."doctorId"
WHERE pat.name ILIKE '%Manuel%Valenzuela%'
ORDER BY p."createdAt" ASC;

-- Resultado esperado: la fila del 21/04/2026 muestra doctor_asignado = "Elissa ..."
-- El frontend lo reflejará automáticamente en la próxima carga (Cobros / Liquidaciones).
