-- ═══════════════════════════════════════════════════════════════════════════
-- SCRIPT: cleanup_ghost_liquidations.sql
-- Propósito: Identifica y elimina Liquidations fantasma creadas por el bug
--            anterior (liquidaciones sin paymentId real asociado).
--
-- INSTRUCCIONES:
--   1. Ejecuta primero el BLOQUE DE PREVIEW para revisar qué filas se borrarían.
--   2. Si el resultado es correcto, ejecuta el BLOQUE DE BORRADO SEGURO.
--
-- CONDICIÓN DE SEGURIDAD:
--   Solo se eliminan filas donde paymentId IS NULL *Y* la cita asociada
--   no está marcada como pagada (paid = false / null). Esto evita borrar
--   liquidaciones legítimas que pudieran tener paymentId vacío por error
--   de migración pero correspondan a citas realmente cobradas.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. PREVIEW: ¿Cuántas filas fantasma existen? ─────────────────────────────
SELECT
    l.id,
    l."doctorId",
    l."grossAmount",
    l."finalAmount",
    l."treatmentName",
    l."patientName",
    l."createdAt",
    l."appointmentId",
    a.paid AS "cita_cobrada"
FROM "Liquidation" l
LEFT JOIN "Appointment" a ON a.id = l."appointmentId"
WHERE l."paymentId" IS NULL
  AND (
        l."appointmentId" IS NULL
        OR a.paid IS DISTINCT FROM true
      )
ORDER BY l."createdAt" DESC;


-- ── 2. BORRADO SEGURO: Elimina solo las filas fantasma confirmadas ────────────
-- ¡¡ Descomenta el bloque siguiente ÚNICAMENTE después de revisar el preview !!

/*
DELETE FROM "Liquidation"
WHERE "paymentId" IS NULL
  AND (
        "appointmentId" IS NULL
        OR NOT EXISTS (
            SELECT 1 FROM "Appointment" a
            WHERE a.id = "Liquidation"."appointmentId"
              AND a.paid = true
        )
      );
*/


-- ── 3. VERIFICACIÓN POST-BORRADO: Confirma que no quedan fantasmas ────────────
-- Ejecuta esto tras el DELETE para confirmar limpieza completa:

/*
SELECT COUNT(*) AS ghost_liquidations_remaining
FROM "Liquidation"
WHERE "paymentId" IS NULL;
*/
