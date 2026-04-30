-- ============================================================
-- MIGRACIÓN: Añadir appointment_id a whatsapp_queue
--
-- ⚠️  EJECUTAR EN SUPABASE SQL EDITOR
-- Permite vincular mensajes en cola con su cita de origen,
-- para actualizarlos o borrarlos si la cita cambia/cancela.
-- ============================================================

ALTER TABLE whatsapp_queue
ADD COLUMN IF NOT EXISTS appointment_id TEXT;

CREATE INDEX IF NOT EXISTS idx_waq_appointment_id
    ON whatsapp_queue (appointment_id)
    WHERE appointment_id IS NOT NULL;

-- Verificación
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'whatsapp_queue'
  AND column_name = 'appointment_id';
