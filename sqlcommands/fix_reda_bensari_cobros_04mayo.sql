-- ============================================================================
-- CORRECCIÓN COBROS REDA BENSARI — 04/05/2026
-- ============================================================================
--
-- PROBLEMA 1: F-2026-1776766509181 (CARD) → importe 310€ en lugar de 250€
-- PROBLEMA 2: F-2026-1776766509180 (CASH) → sin doctorId (Dra. Elissa EID)
--             y por tanto no computa en sus liquidaciones
--
-- RESUMEN DE LO CORRECTO:
--   Tratamiento total : 310€
--   Cobro CASH        : 60€  (factura F-2026-1776766509180)  ← sólo falta doctor
--   Cobro CARD        : 250€ (factura F-2026-1776766509181)  ← hay que cambiar 310→250
--   Doctor responsable: Dra. Elissa EID (ambos cobros)
--
-- ⚠️  Ejecutar en orden. Confirmar PASO 1 (verificación) antes de PASO 2 (corrección).
-- ============================================================================


-- ============================================================================
-- PASO 1: VERIFICAR el estado actual de los dos cobros
-- ============================================================================

SELECT
    i."invoiceNumber",
    p.id             AS payment_id,
    p.amount,
    p.method,
    p."doctorId",
    d.name           AS doctor_asignado,
    pat.name         AS paciente,
    p."createdAt"::date AS fecha
FROM "Payment" p
JOIN "Invoice" i  ON i.id = p."invoiceId"
JOIN "Patient" pat ON pat.id = p."patientId"
LEFT JOIN "Doctor" d ON d.id = p."doctorId"
WHERE i."invoiceNumber" IN (
    'F-2026-1776766509180',
    'F-2026-1776766509181'
)
ORDER BY i."invoiceNumber";

-- Resultado esperado:
--   F-2026-1776766509180 → 60€,  CASH, doctorId = NULL,      paciente = Reda Bensari
--   F-2026-1776766509181 → 310€, CARD, doctorId = <Elissa ID>, paciente = Reda Bensari


-- ============================================================================
-- PASO 2: CORRECCIÓN COMPLETA (ambas facturas en una sola transacción)
-- ============================================================================

DO $$
DECLARE
    v_doctor_id     TEXT;
    v_inv_cash_id   TEXT;
    v_inv_card_id   TEXT;
    v_pay_cash_id   TEXT;
    v_pay_card_id   TEXT;
BEGIN
    -- 1. Obtener doctorId de la Dra. Elissa EID
    SELECT id INTO v_doctor_id
    FROM "Doctor"
    WHERE name ILIKE '%Elissa%'
    LIMIT 1;

    IF v_doctor_id IS NULL THEN
        RAISE EXCEPTION 'ABORTADO: No se encontró ningún doctor con nombre Elissa en la tabla Doctor.';
    END IF;
    RAISE NOTICE 'Dra. Elissa EID → id: %', v_doctor_id;

    -- 2. Obtener el id de la factura CASH (F-2026-1776766509180)
    SELECT id INTO v_inv_cash_id
    FROM "Invoice"
    WHERE "invoiceNumber" = 'F-2026-1776766509180'
    LIMIT 1;

    IF v_inv_cash_id IS NULL THEN
        RAISE EXCEPTION 'ABORTADO: No se encontró la factura F-2026-1776766509180.';
    END IF;

    -- 3. Obtener el id de la factura CARD (F-2026-1776766509181)
    SELECT id INTO v_inv_card_id
    FROM "Invoice"
    WHERE "invoiceNumber" = 'F-2026-1776766509181'
    LIMIT 1;

    IF v_inv_card_id IS NULL THEN
        RAISE EXCEPTION 'ABORTADO: No se encontró la factura F-2026-1776766509181.';
    END IF;

    -- 4. Obtener el Payment de CASH
    SELECT id INTO v_pay_cash_id
    FROM "Payment"
    WHERE "invoiceId" = v_inv_cash_id
    LIMIT 1;

    IF v_pay_cash_id IS NULL THEN
        RAISE EXCEPTION 'ABORTADO: No se encontró el Payment asociado a F-2026-1776766509180.';
    END IF;

    -- 5. Obtener el Payment de CARD
    SELECT id INTO v_pay_card_id
    FROM "Payment"
    WHERE "invoiceId" = v_inv_card_id
    LIMIT 1;

    IF v_pay_card_id IS NULL THEN
        RAISE EXCEPTION 'ABORTADO: No se encontró el Payment asociado a F-2026-1776766509181.';
    END IF;

    -- -------------------------------------------------------------------------
    -- CORRECCIÓN A: Asignar doctorId al cobro CASH (60€ — F-2026-1776766509180)
    -- -------------------------------------------------------------------------
    UPDATE "Payment"
    SET "doctorId" = v_doctor_id
    WHERE id = v_pay_cash_id;

    RAISE NOTICE '✅ [CASH] doctorId asignado → payment_id: %', v_pay_cash_id;

    -- -------------------------------------------------------------------------
    -- CORRECCIÓN B: Cambiar importe 310€ → 250€ en el cobro CARD (F-2026-1776766509181)
    -- -------------------------------------------------------------------------
    UPDATE "Payment"
    SET amount = 250
    WHERE id = v_pay_card_id;

    UPDATE "Invoice"
    SET amount = 250
    WHERE id = v_inv_card_id;

    RAISE NOTICE '✅ [CARD] Importe actualizado 310€ → 250€ en Payment e Invoice → payment_id: %', v_pay_card_id;

    RAISE NOTICE '✅ Corrección completada. Ambos cobros de Reda Bensari están ahora correctos.';
END $$;


-- ============================================================================
-- PASO 3: VERIFICAR el resultado final
-- ============================================================================

SELECT
    i."invoiceNumber",
    p.id             AS payment_id,
    p.amount,
    p.method,
    p."doctorId",
    d.name           AS doctor_asignado,
    pat.name         AS paciente,
    p."createdAt"::date AS fecha
FROM "Payment" p
JOIN "Invoice" i  ON i.id = p."invoiceId"
JOIN "Patient" pat ON pat.id = p."patientId"
LEFT JOIN "Doctor" d ON d.id = p."doctorId"
WHERE i."invoiceNumber" IN (
    'F-2026-1776766509180',
    'F-2026-1776766509181'
)
ORDER BY i."invoiceNumber";

-- Resultado esperado tras la corrección:
--   F-2026-1776766509180 → 60€,  CASH, doctor = Dra. Elissa EID, paciente = Reda Bensari ✅
--   F-2026-1776766509181 → 250€, CARD, doctor = Dra. Elissa EID, paciente = Reda Bensari ✅
