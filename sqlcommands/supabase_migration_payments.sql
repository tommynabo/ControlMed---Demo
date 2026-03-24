-- Migration: Add Payments, PatientTreatments, Wallet System
-- Date: 2026-01-23

-- 1. Add wallet field to Patient
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "wallet" DOUBLE PRECISION DEFAULT 0.0;

-- 2. Create PaymentTreatment table (tratamientos asignados a pacientes)
CREATE TABLE IF NOT EXISTS "PatientTreatment" (
  "id" TEXT PRIMARY KEY,
  "patientId" TEXT NOT NULL,
  "serviceId" TEXT NOT NULL REFERENCES "Treatment"("id"),
  "toothId" INTEGER,
  "customPrice" DOUBLE PRECISION,  
  "status" TEXT DEFAULT 'PENDIENTE',
  "notes" TEXT,
  "createdAt" TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "PatientTreatment_patientId_idx" ON "PatientTreatment"("patientId");
CREATE INDEX IF NOT EXISTS "PatientTreatment_serviceId_idx" ON "PatientTreatment"("serviceId");

-- 3. Create Payment table
CREATE TABLE IF NOT EXISTS "Payment" (
  "id" TEXT PRIMARY KEY,
  "patientId" TEXT NOT NULL REFERENCES "Patient"("id"),
  "budgetId" TEXT,
  "amount" DOUBLE PRECISION NOT NULL,
  "method" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "invoiceId" TEXT UNIQUE,
  "notes" TEXT
);

CREATE INDEX IF NOT EXISTS "Payment_patientId_idx" ON "Payment"("patientId");

-- 4. Add new fields to Invoice
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "concept" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "relatedPaymentId" TEXT UNIQUE;

-- 5. Add relation field to Treatment
ALTER TABLE "Treatment" ADD COLUMN IF NOT EXISTS "patientTreatments" TEXT[];

-- 6. Add foreign key for Payment -> Invoice (optional, can be done later)
-- ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id");

COMMENT ON TABLE "PatientTreatment" IS 'Tratamientos asignados a pacientes específicos con diente y estado';
COMMENT ON TABLE "Payment" IS 'Historial de pagos: cobros directos y pagos a cuenta';
COMMENT ON COLUMN "Patient"."wallet" IS 'Monedero Virtual - Pagos adelantados disponibles';
