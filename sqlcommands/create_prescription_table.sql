-- ============================================================
-- CREAR TABLA DE RECETAS MÉDICAS (Prescription)
-- Ejecutar en Supabase SQL Editor si la tabla no existe
-- ============================================================

CREATE TABLE IF NOT EXISTS "Prescription" (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "patientId"             TEXT NOT NULL REFERENCES "Patient"(id) ON DELETE CASCADE,
  "doctorId"              TEXT,
  medication              TEXT NOT NULL,
  "pharmaceuticalForm"    TEXT,
  "administrationRoute"   TEXT,
  "packagesNumber"        INTEGER,
  dose                    TEXT,
  duration                TEXT,
  posology                TEXT,
  units                   TEXT,
  "schedulePattern"       TEXT,
  "prescriptionDate"      TIMESTAMP DEFAULT NOW(),
  "dispensationDate"      TIMESTAMP,
  "dispensationOrderNumber" TEXT,
  diagnosis               TEXT,
  "patientInstructions"   TEXT,
  "pharmacyInstructions"  TEXT,
  "prescriberName"        TEXT,
  "prescriberSpecialty"   TEXT,
  "createdAt"             TIMESTAMP DEFAULT NOW(),
  deleted_at              TIMESTAMP
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_prescription_patient ON "Prescription"("patientId");
CREATE INDEX IF NOT EXISTS idx_prescription_date    ON "Prescription"("prescriptionDate");
CREATE INDEX IF NOT EXISTS idx_prescription_active  ON "Prescription"(deleted_at) WHERE deleted_at IS NULL;

-- RLS
ALTER TABLE "Prescription" ENABLE ROW LEVEL SECURITY;

-- Política permisiva: el backend usa service_role key (bypasses RLS)
-- Estas políticas son para accesos directos desde el cliente si se necesitan
CREATE POLICY "prescription_all_authenticated" ON "Prescription"
  FOR ALL USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- ============================================================
-- VERIFICACIÓN
-- ============================================================
SELECT COUNT(*) as tabla_creada FROM information_schema.tables 
WHERE table_name = 'Prescription' AND table_schema = 'public';
