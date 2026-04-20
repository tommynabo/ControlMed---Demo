-- ============================================================
-- CREAR TABLA DE RECORDATORIOS PARA SEGUIMIENTO PACIENTES
-- ============================================================

-- Tabla Reminder para almacenar recordatorios personalizados
CREATE TABLE IF NOT EXISTS "Reminder" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES "Patient"(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  due_date DATE NOT NULL,
  priority VARCHAR(20) DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH')),
  status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'CANCELLED')),
  notes TEXT,
  completed_at TIMESTAMP,
  notification_sent BOOLEAN DEFAULT FALSE,
  notification_method VARCHAR(50) DEFAULT 'IN_APP' CHECK (notification_method IN ('IN_APP', 'WHATSAPP', 'EMAIL', 'BOTH')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS "idx_reminder_patient" ON "Reminder"(patient_id);
CREATE INDEX IF NOT EXISTS "idx_reminder_duedate" ON "Reminder"(due_date);
CREATE INDEX IF NOT EXISTS "idx_reminder_status" ON "Reminder"(status);
CREATE INDEX IF NOT EXISTS "idx_reminder_pending_due" ON "Reminder"(status, due_date) WHERE status = 'PENDING';

-- Enable RLS
ALTER TABLE "Reminder" ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Usuarios pueden ver recordatorios de sus pacientes
CREATE POLICY "reminder_view_policy" ON "Reminder"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM "Patient" p
      WHERE p.id = "Reminder".patient_id
    )
  );

-- RLS Policy: Usuarios pueden crear recordatorios
CREATE POLICY "reminder_insert_policy" ON "Reminder"
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM "Patient" p
      WHERE p.id = "Reminder".patient_id
    )
  );

-- RLS Policy: Usuarios pueden actualizar recordatorios
CREATE POLICY "reminder_update_policy" ON "Reminder"
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM "Patient" p
      WHERE p.id = "Reminder".patient_id
    )
  );

-- RLS Policy: Usuarios pueden eliminar recordatorios
CREATE POLICY "reminder_delete_policy" ON "Reminder"
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM "Patient" p
      WHERE p.id = "Reminder".patient_id
    )
  );

-- ============================================================
-- VERIFICACIÓN
-- ============================================================
SELECT COUNT(*) as tabla_creada FROM information_schema.tables 
WHERE table_name = 'Reminder' AND table_schema = 'public';
