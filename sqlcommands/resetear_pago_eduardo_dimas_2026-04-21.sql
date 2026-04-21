-- ============================================================================
-- RESETEAR PAGO CITA EDUARDO DIMAS — 21/04/2026
-- ============================================================================
--
-- La cita de Eduardo Dimas aparece como "Cobrada" (paid = true) aunque
-- la factura F-2026-1776683752774 fue eliminada el 20/04/2026.
-- Este script resetea paid = false para poder cobrarle desde la cita.
--
-- INSTRUCCIONES:
--   1. Ejecutar PASO 1 para confirmar cuál es la cita afectada.
--   2. Si es correcta, ejecutar PASO 2 para resetear paid = false.
--   3. Ejecutar PASO 3 para verificar que quedó correctamente.
-- ============================================================================


-- ============================================================================
-- PASO 1: VERIFICAR la(s) cita(s) de Eduardo Dimas marcadas como pagadas
-- ============================================================================

SELECT
    a.id,
    a.date,
    a.time,
    a.status,
    a.paid,
    a."treatmentName",
    a.amount,
    p.name AS paciente
FROM "Appointment" a
JOIN "Patient" p ON p.id = a."patientId"
WHERE LOWER(p.name) LIKE '%eduardo%dimas%'
  AND a.deleted_at IS NULL
ORDER BY a.date DESC;

-- Resultado esperado: cita del 21/04/2026 con paid = true


-- ============================================================================
-- PASO 2: RESETEAR paid = false en las citas de Eduardo Dimas sin factura
-- ============================================================================
--
-- Resetea SOLO las citas que tienen paid = true pero no tienen
-- una factura activa asociada (para no tocar pagos legítimos).

UPDATE "Appointment" a
SET paid = false
WHERE a."patientId" IN (
    SELECT id FROM "Patient" WHERE LOWER(name) LIKE '%eduardo%dimas%'
)
AND a.paid = true
AND a.deleted_at IS NULL
AND NOT EXISTS (
    -- Verificar que no haya una factura activa vinculada a este paciente
    -- para la misma fecha (salvaguarda por si tiene otro pago real)
    SELECT 1
    FROM "Invoice" i
    WHERE i."patientId" = a."patientId"
      AND i.date::date = a.date
      AND i.status NOT IN ('CANCELLED', 'cancelled')
)
RETURNING id, date, time, paid, status, "treatmentName";

-- Resultado esperado: 1 fila con paid = false


-- ============================================================================
-- PASO 3: VERIFICAR el resultado final
-- ============================================================================

SELECT
    a.id,
    a.date,
    a.time,
    a.status,
    a.paid,
    a."treatmentName",
    a.amount,
    p.name AS paciente
FROM "Appointment" a
JOIN "Patient" p ON p.id = a."patientId"
WHERE LOWER(p.name) LIKE '%eduardo%dimas%'
  AND a.deleted_at IS NULL
ORDER BY a.date DESC;

-- La cita del 21/04/2026 debería tener paid = false y mostrar el botón "Cobrar / Pagar"
