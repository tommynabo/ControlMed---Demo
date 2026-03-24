-- Complete migration for PatientTreatment table
-- Run this in Supabase SQL Editor
-- This creates the table from scratch with all needed columns

-- Create PatientTreatment table (tratamientos asignados a pacientes desde el odontograma)
CREATE TABLE IF NOT EXISTS "PatientTreatment" (
  "id" TEXT PRIMARY KEY,
  "patientId" TEXT NOT NULL,
  "serviceId" TEXT,  -- NULL allowed - we store serviceName directly instead
  "serviceName" TEXT NOT NULL,  -- Nombre del tratamiento
  "toothId" INTEGER,
  "price" DOUBLE PRECISION DEFAULT 0,  -- Precio del tratamiento
  "customPrice" DOUBLE PRECISION,  
  "status" TEXT DEFAULT 'PENDIENTE',
  "notes" TEXT,
  "createdAt" TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "PatientTreatment_patientId_idx" ON "PatientTreatment"("patientId");

-- Add comment
COMMENT ON TABLE "PatientTreatment" IS 'Tratamientos asignados a pacientes desde el odontograma';
