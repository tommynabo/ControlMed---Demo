-- ============================================================================
-- ELIMINAR LIQUIDACIÓN HUÉRFANA PARA EDUARDO DIMAS — 21/04/2026
-- ============================================================================
--
-- La cita de Eduardo Dimas (hoy 21/04/2026 a las 10:00 con Dra. Concejero)
-- tiene una liquidación huérfana que impide procesar el cobro porque
-- la factura fue eliminada pero la liquidación quedó vinculada al appointmentId.
--
-- Esta liquidación no tiene una factura activa asociada, por lo que es seguro
-- eliminarla. Con esto, el endpoint de pagos podrá crear una nueva liquidación.
--
-- INSTRUCCIONES:
--   1. Ejecutar PASO 1 para identificar la liquidación huérfana.
--   2. Si es correcta, ejecutar PASO 2 para eliminarla.
--   3. Ejecutar PASO 3 para confirmar que fue eliminada.
--   4. Luego intentar procesar el cobro desde la cita en el CRM.
-- ============================================================================


-- ============================================================================
-- PASO 1: IDENTIFICAR la liquidación huérfana para Eduardo Dimas
-- ============================================================================

SELECT
    l.id,
    l."appointmentId",
    l."doctorId",
    l."grossAmount",
    l."finalAmount",
    l.status,
    l."createdAt",
    a.date,
    a.time,
    a.paid,
    p.name AS paciente
FROM "Liquidation" l
JOIN "Appointment" a ON a.id = l."appointmentId"
JOIN "Patient" p ON p.id = a."patientId"
WHERE LOWER(p.name) LIKE '%eduardo%dimas%'
  AND a.date = '2026-04-21'
  AND a.time = '10:00'
  AND a.deleted_at IS NULL;

-- Resultado esperado: 1 fila con la liquidación huérfana


-- ============================================================================
-- PASO 2: ELIMINAR la liquidación huérfana
-- ============================================================================
--
-- ADVERTENCIA: Una vez eliminada, no se puede recuperar.
-- Pero el endpoint de pagos podrá crear una nueva liquidación cuando
-- se procese el cobro.

DELETE FROM "Liquidation"
WHERE "appointmentId" IN (
    SELECT a.id
    FROM "Appointment" a
    JOIN "Patient" p ON p.id = a."patientId"
    WHERE LOWER(p.name) LIKE '%eduardo%dimas%'
      AND a.date = '2026-04-21'
      AND a.time = '10:00'
      AND a.deleted_at IS NULL
)
RETURNING id, "appointmentId", "doctorId", status;

-- Resultado esperado: 1 fila eliminada


-- ============================================================================
-- PASO 3: VERIFICAR que la liquidación fue eliminada
-- ============================================================================

SELECT
    l.id,
    l."appointmentId",
    l.status,
    a.date,
    a.time,
    p.name AS paciente
FROM "Liquidation" l
JOIN "Appointment" a ON a.id = l."appointmentId"
JOIN "Patient" p ON p.id = a."patientId"
WHERE LOWER(p.name) LIKE '%eduardo%dimas%'
  AND a.date = '2026-04-21'
  AND a.time = '10:00';

-- Resultado esperado: 0 filas (liquidación eliminada exitosamente)


-- ============================================================================
-- CONFIRMACIÓN: La cita ahora debe poder procesarse el cobro
-- ============================================================================
-- 
-- En el CRM, abre la cita de Eduardo Dimas:
--   - Verifica que el botón "Cobrar / Pagar" esté disponible
--   - Si aún no aparece, recarga la página
--   - Intenta procesar el cobro nuevamente
--
-- El endpoint /api/finance/payments/create ahora:
--   1. No encontrará una liquidación preexistente
--   2. Creará una NUEVA liquidación correctamente
--   3. Procesará el pago sin errores de "Unique constraint"
-- ============================================================================
