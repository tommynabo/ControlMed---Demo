-- ============================================================================
-- DIAGNÓSTICO + FIX: Liquidación duplicada — Amaya Espiga Alonzo
-- Dr. Kevin Chrabieh — Abril 2026
-- ============================================================================
-- Problema (visible en la liquidación impresa):
--   Amaya Espiga aparece DOS veces con "Blanqueamiento Domiciliario - Diente 11"
--   a 350 €:
--     - 17/04/2026  ← CORRECTA  (marcada como original)
--     - 20/04/2026  ← DUPLICADA (marcada a mano "Duplicado X")
--
-- INSTRUCCIONES:
--   1. Ejecutar PASO 1 — confirmar que hay 2 filas para ese tratamiento.
--   2. Ejecutar PASO 2 — eliminar la fila duplicada (la del 20/04).
--   3. Ejecutar PASO 3 — verificar que queda una sola fila.
-- ⚠️  Ejecutar en Supabase → SQL Editor
-- ============================================================================


-- ─── PASO 1: Diagnóstico — ver todas las Liquidations de Amaya con Kevin ─────
-- Resultado esperado ANTES del fix:
--   2 filas con treatmentName ~ "Blanqueamiento" y grossAmount = 350
SELECT
    l.id                AS liquidation_id,
    l."patientName",
    l."treatmentName",
    l."grossAmount",
    l."finalAmount",
    l."commissionRate",
    l."createdAt"       AS liq_createdAt,
    a.date              AS cita_fecha,
    a.id                AS appointment_id,
    d.name              AS doctor
FROM "Liquidation" l
JOIN  "Doctor" d ON d.id = l."doctorId"
LEFT JOIN "Appointment" a ON a.id = l."appointmentId"
WHERE d.name ILIKE '%chrabieh%'
  AND l."patientName" ILIKE '%amaya%espiga%'
  AND COALESCE(a.date, l."createdAt"::date) >= '2026-04-01'
  AND COALESCE(a.date, l."createdAt"::date) <  '2026-05-01'
ORDER BY COALESCE(a.date, l."createdAt"::date), l."treatmentName";


-- ─── PASO 2: Eliminar la Liquidation duplicada ───────────────────────────────
-- Estrategia: de las dos filas con Blanqueamiento/350€, borra la de fecha
-- más reciente (20/04). La guarda con CTE para que sea idempotente.
--
-- Si PASO 1 muestra solo 1 fila con Blanqueamiento → NO ejecutar este bloque.
WITH duplicados AS (
    SELECT
        l.id,
        ROW_NUMBER() OVER (
            PARTITION BY l."patientName", l."treatmentName", l."grossAmount"
            ORDER BY COALESCE(a.date, l."createdAt"::date) ASC   -- la primera (17/04) se conserva
        ) AS rn
    FROM "Liquidation" l
    JOIN  "Doctor" d ON d.id = l."doctorId"
    LEFT JOIN "Appointment" a ON a.id = l."appointmentId"
    WHERE d.name ILIKE '%chrabieh%'
      AND l."patientName" ILIKE '%amaya%espiga%'
      AND l."treatmentName" ILIKE '%blanqueamiento%'
      AND l."grossAmount" = 350
      AND COALESCE(a.date, l."createdAt"::date) >= '2026-04-01'
      AND COALESCE(a.date, l."createdAt"::date) <  '2026-05-01'
)
DELETE FROM "Liquidation"
WHERE id IN (
    SELECT id FROM duplicados WHERE rn > 1   -- borra la 2ª, 3ª… (la duplicada)
);
-- Resultado esperado: "DELETE 1"


-- ─── PASO 3: Verificación final ──────────────────────────────────────────────
-- Resultado esperado: 2 filas para Amaya (Blanqueamiento 350€ + Tartrectomia 60€)
SELECT
    l."patientName",
    l."treatmentName",
    l."grossAmount",
    l."finalAmount",
    a.date              AS cita_fecha,
    l."createdAt"       AS liq_fecha
FROM "Liquidation" l
JOIN  "Doctor" d ON d.id = l."doctorId"
LEFT JOIN "Appointment" a ON a.id = l."appointmentId"
WHERE d.name ILIKE '%chrabieh%'
  AND l."patientName" ILIKE '%amaya%espiga%'
  AND COALESCE(a.date, l."createdAt"::date) >= '2026-04-01'
  AND COALESCE(a.date, l."createdAt"::date) <  '2026-05-01'
ORDER BY COALESCE(a.date, l."createdAt"::date);


-- ─── PASO 4: Totales de Kevin en Abril 2026 (para cuadrar el PDF) ────────────
-- Con la duplicada eliminada el total bruto debe bajar ~350€.
SELECT
    COUNT(*)                  AS num_registros,
    SUM(l."grossAmount")      AS total_bruto,
    SUM(l."finalAmount")      AS total_a_pagar_dr
FROM "Liquidation" l
JOIN  "Doctor" d ON d.id = l."doctorId"
LEFT JOIN "Appointment" a ON a.id = l."appointmentId"
WHERE d.name ILIKE '%chrabieh%'
  AND COALESCE(a.date, l."createdAt"::date) >= '2026-04-01'
  AND COALESCE(a.date, l."createdAt"::date) <  '2026-05-01';
