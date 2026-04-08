-- ==============================================================================
-- SCRIPT: Habilitar RLS y Políticas de Seguridad en Todas las Tablas
-- Propósito: Resolver todos los errores de seguridad en Supabase
-- Fecha: 2026-02-18
-- ==============================================================================

-- ==============================================================================
-- FUNCIONES DE SEGURIDAD AUXILIARES
-- ==============================================================================

-- Función para obtener el role del usuario actual
CREATE OR REPLACE FUNCTION get_user_role() RETURNS TEXT AS $$
BEGIN
  RETURN COALESCE(
    (SELECT role FROM system_users WHERE id = auth.uid()),
    (SELECT role FROM "User" WHERE "id" = auth.uid()),
    'GUEST'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para verificar si es admin
CREATE OR REPLACE FUNCTION is_admin() RETURNS BOOLEAN AS $$
BEGIN
  RETURN get_user_role() = 'ADMIN';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para verificar si es doctor (checks isDoctor flag OR role=DOCTOR)
CREATE OR REPLACE FUNCTION is_doctor() RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM "User"
    WHERE "id" = auth.uid()::TEXT
      AND ("isDoctor" = true OR role = 'DOCTOR')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- TABLA: User
-- ==============================================================================
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;

-- Solo admins pueden ver todos los usuarios
-- Los usuarios pueden ver su propio perfil
CREATE POLICY "User: Admin see all" ON "User"
  FOR SELECT
  USING (is_admin());

CREATE POLICY "User: Users see own profile" ON "User"
  FOR SELECT
  USING (auth.uid()::TEXT = "id");

-- Solo admins pueden insertar/actualizar/eliminar usuarios
CREATE POLICY "User: Admin insert" ON "User"
  FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "User: Admin update" ON "User"
  FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "User: Users update own profile" ON "User"
  FOR UPDATE
  USING (auth.uid()::TEXT = "id")
  WITH CHECK (auth.uid()::TEXT = "id");

CREATE POLICY "User: Admin delete" ON "User"
  FOR DELETE
  USING (is_admin());

-- ==============================================================================
-- TABLA: Patient
-- ==============================================================================
ALTER TABLE "Patient" ENABLE ROW LEVEL SECURITY;

-- Admins ven todos los pacientes
CREATE POLICY "Patient: Admin see all" ON "Patient"
  FOR SELECT
  USING (is_admin());

-- Doctores ven sus propios pacientes
CREATE POLICY "Patient: Doctor see assigned" ON "Patient"
  FOR SELECT
  USING (
    "assignedDoctorId" = (
      SELECT "id" FROM "Doctor" WHERE "id" IN (
        SELECT "doctorId" FROM "User" WHERE "id" = auth.uid()::TEXT
      )
    )
  );

-- Admins pueden insertar/actualizar/eliminar
CREATE POLICY "Patient: Admin full access" ON "Patient"
  FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "Patient: Admin update" ON "Patient"
  FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Patient: Admin delete" ON "Patient"
  FOR DELETE
  USING (is_admin());

-- ==============================================================================
-- TABLA: Doctor
-- ==============================================================================
ALTER TABLE "Doctor" ENABLE ROW LEVEL SECURITY;

-- Doctores e Admins ven la lista de doctores
CREATE POLICY "Doctor: Public read" ON "Doctor"
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Solo admins pueden crear/actualizar/eliminar doctores
CREATE POLICY "Doctor: Admin insert" ON "Doctor"
  FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "Doctor: Admin update" ON "Doctor"
  FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Doctor: Admin delete" ON "Doctor"
  FOR DELETE
  USING (is_admin());

-- ==============================================================================
-- TABLA: Appointment
-- ==============================================================================
ALTER TABLE "Appointment" ENABLE ROW LEVEL SECURITY;

-- Admins ven todas las citas
CREATE POLICY "Appointment: Admin see all" ON "Appointment"
  FOR SELECT
  USING (is_admin());

-- Doctores ven sus propias citas
CREATE POLICY "Appointment: Doctor see own" ON "Appointment"
  FOR SELECT
  USING (
    "doctorId" IN (
      SELECT "id" FROM "Doctor" WHERE "id" IN (
        SELECT "doctorId" FROM "User" WHERE "id" = auth.uid()::TEXT
      )
    )
  );

-- Admins pueden crear/actualizar/eliminar citas
CREATE POLICY "Appointment: Admin insert" ON "Appointment"
  FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "Appointment: Admin update" ON "Appointment"
  FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Appointment: Admin delete" ON "Appointment"
  FOR DELETE
  USING (is_admin());

-- ==============================================================================
-- TABLA: Treatment
-- ==============================================================================
ALTER TABLE "Treatment" ENABLE ROW LEVEL SECURITY;

-- Todos pueden ver tratamientos (son datos de configuración)
CREATE POLICY "Treatment: Public read" ON "Treatment"
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Solo admins pueden crear/actualizar/eliminar
CREATE POLICY "Treatment: Admin insert" ON "Treatment"
  FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "Treatment: Admin update" ON "Treatment"
  FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Treatment: Admin delete" ON "Treatment"
  FOR DELETE
  USING (is_admin());

-- ==============================================================================
-- TABLA: PatientTreatment
-- ==============================================================================
ALTER TABLE "PatientTreatment" ENABLE ROW LEVEL SECURITY;

-- Admins ven todos
CREATE POLICY "PatientTreatment: Admin see all" ON "PatientTreatment"
  FOR SELECT
  USING (is_admin());

-- Doctores ven tratamientos de sus pacientes
CREATE POLICY "PatientTreatment: Doctor see patient's" ON "PatientTreatment"
  FOR SELECT
  USING (
    "patientId" IN (
      SELECT "id" FROM "Patient" WHERE "assignedDoctorId" IN (
        SELECT "id" FROM "Doctor" WHERE "id" IN (
          SELECT "doctorId" FROM "User" WHERE "id" = auth.uid()::TEXT
        )
      )
    )
  );

-- Solo admins pueden insertar/actualizar/eliminar
CREATE POLICY "PatientTreatment: Admin insert" ON "PatientTreatment"
  FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "PatientTreatment: Admin update" ON "PatientTreatment"
  FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "PatientTreatment: Admin delete" ON "PatientTreatment"
  FOR DELETE
  USING (is_admin());

-- ==============================================================================
-- TABLA: Invoice
-- ==============================================================================
ALTER TABLE "Invoice" ENABLE ROW LEVEL SECURITY;

-- Admins ven todas las facturas
CREATE POLICY "Invoice: Admin see all" ON "Invoice"
  FOR SELECT
  USING (is_admin());

-- Solo admins pueden crear/actualizar/eliminar
CREATE POLICY "Invoice: Admin insert" ON "Invoice"
  FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "Invoice: Admin update" ON "Invoice"
  FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Invoice: Admin delete" ON "Invoice"
  FOR DELETE
  USING (is_admin());

-- ==============================================================================
-- TABLA: InvoiceItem
-- ==============================================================================
ALTER TABLE "InvoiceItem" ENABLE ROW LEVEL SECURITY;

-- Admins ven todos los items
CREATE POLICY "InvoiceItem: Admin see all" ON "InvoiceItem"
  FOR SELECT
  USING (is_admin());

-- Solo admins pueden crear/actualizar/eliminar
CREATE POLICY "InvoiceItem: Admin insert" ON "InvoiceItem"
  FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "InvoiceItem: Admin update" ON "InvoiceItem"
  FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "InvoiceItem: Admin delete" ON "InvoiceItem"
  FOR DELETE
  USING (is_admin());

-- ==============================================================================
-- TABLA: TreatmentPlan
-- ==============================================================================
ALTER TABLE "TreatmentPlan" ENABLE ROW LEVEL SECURITY;

-- Admins ven todos los planes
CREATE POLICY "TreatmentPlan: Admin see all" ON "TreatmentPlan"
  FOR SELECT
  USING (is_admin());

-- Doctores ven planes de sus pacientes
CREATE POLICY "TreatmentPlan: Doctor see patient's" ON "TreatmentPlan"
  FOR SELECT
  USING (
    "patientId" IN (
      SELECT "id" FROM "Patient" WHERE "assignedDoctorId" IN (
        SELECT "id" FROM "Doctor" WHERE "id" IN (
          SELECT "doctorId" FROM "User" WHERE "id" = auth.uid()::TEXT
        )
      )
    )
  );

-- Solo admins pueden crear/actualizar/eliminar
CREATE POLICY "TreatmentPlan: Admin insert" ON "TreatmentPlan"
  AS INSERT
  WITH CHECK (is_admin());

CREATE POLICY "TreatmentPlan: Admin update" ON "TreatmentPlan"
  AS UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "TreatmentPlan: Admin delete" ON "TreatmentPlan"
  AS DELETE
  USING (is_admin());

-- ==============================================================================
-- TABLA: Installment
-- ==============================================================================
ALTER TABLE "Installment" ENABLE ROW LEVEL SECURITY;

-- Admins ven todos los pagos
CREATE POLICY "Installment: Admin see all" ON "Installment"
  FOR SELECT
  USING (is_admin());

-- Solo admins pueden crear/actualizar/eliminar
CREATE POLICY "Installment: Admin insert" ON "Installment"
  FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "Installment: Admin update" ON "Installment"
  FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Installment: Admin delete" ON "Installment"
  FOR DELETE
  USING (is_admin());

-- ==============================================================================
-- TABLA: ClinicalRecord
-- ==============================================================================
ALTER TABLE "ClinicalRecord" ENABLE ROW LEVEL SECURITY;

-- Admins ven todos los registros
CREATE POLICY "ClinicalRecord: Admin see all" ON "ClinicalRecord"
  FOR SELECT
  USING (is_admin());

-- Doctores ven registros de sus pacientes
CREATE POLICY "ClinicalRecord: Doctor see patient's" ON "ClinicalRecord"
  FOR SELECT
  USING (
    "patientId" IN (
      SELECT "id" FROM "Patient" WHERE "assignedDoctorId" IN (
        SELECT "id" FROM "Doctor" WHERE "id" IN (
          SELECT "doctorId" FROM "User" WHERE "id" = auth.uid()::TEXT
        )
      )
    )
  );

-- Solo admins pueden crear/actualizar/eliminar
CREATE POLICY "ClinicalRecord: Admin insert" ON "ClinicalRecord"
  FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "ClinicalRecord: Admin update" ON "ClinicalRecord"
  FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "ClinicalRecord: Admin delete" ON "ClinicalRecord"
  FOR DELETE
  USING (is_admin());

-- ==============================================================================
-- TABLA: Liquidation
-- ==============================================================================
ALTER TABLE "Liquidation" ENABLE ROW LEVEL SECURITY;

-- Admins ven todas las liquidaciones
CREATE POLICY "Liquidation: Admin see all" ON "Liquidation"
  FOR SELECT
  USING (is_admin());

-- Doctores ven sus propias liquidaciones
CREATE POLICY "Liquidation: Doctor see own" ON "Liquidation"
  FOR SELECT
  USING (
    "doctorId" IN (
      SELECT "id" FROM "Doctor" WHERE "id" IN (
        SELECT "doctorId" FROM "User" WHERE "id" = auth.uid()::TEXT
      )
    )
  );

-- Solo admins pueden crear/actualizar/eliminar
CREATE POLICY "Liquidation: Admin insert" ON "Liquidation"
  FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "Liquidation: Admin update" ON "Liquidation"
  FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Liquidation: Admin delete" ON "Liquidation"
  FOR DELETE
  USING (is_admin());

-- ==============================================================================
-- TABLA: system_users
-- ==============================================================================
ALTER TABLE "system_users" ENABLE ROW LEVEL SECURITY;

-- Admins ven todos los usuarios
CREATE POLICY "system_users: Admin see all" ON "system_users"
  FOR SELECT
  USING (is_admin());

-- Los usuarios pueden ver su propio perfil
CREATE POLICY "system_users: Users see own" ON "system_users"
  FOR SELECT
  USING (auth.uid() = "id");

-- Solo admins pueden insertar/actualizar/eliminar
CREATE POLICY "system_users: Admin insert" ON "system_users"
  FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "system_users: Admin update" ON "system_users"
  FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "system_users: Users update own" ON "system_users"
  FOR UPDATE
  USING (auth.uid() = "id")
  WITH CHECK (auth.uid() = "id");

CREATE POLICY "system_users: Admin delete" ON "system_users"
  FOR DELETE
  USING (is_admin());

-- ==============================================================================
-- TABLA: InventoryItem
-- ==============================================================================
ALTER TABLE "InventoryItem" ENABLE ROW LEVEL SECURITY;

-- Todos pueden ver inventario
CREATE POLICY "InventoryItem: Public read" ON "InventoryItem"
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Solo admins pueden crear/actualizar/eliminar
CREATE POLICY "InventoryItem: Admin insert" ON "InventoryItem"
  FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "InventoryItem: Admin update" ON "InventoryItem"
  FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "InventoryItem: Admin delete" ON "InventoryItem"
  FOR DELETE
  USING (is_admin());

-- ==============================================================================
-- TABLA: DocumentTemplate
-- ==============================================================================
ALTER TABLE "DocumentTemplate" ENABLE ROW LEVEL SECURITY;

-- Todos pueden ver plantillas de documentos
CREATE POLICY "DocumentTemplate: Public read" ON "DocumentTemplate"
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Solo admins pueden crear/actualizar/eliminar
CREATE POLICY "DocumentTemplate: Admin insert" ON "DocumentTemplate"
  FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "DocumentTemplate: Admin update" ON "DocumentTemplate"
  FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "DocumentTemplate: Admin delete" ON "DocumentTemplate"
  FOR DELETE
  USING (is_admin());

-- ==============================================================================
-- TABLA: Specialty
-- ==============================================================================
ALTER TABLE "Specialty" ENABLE ROW LEVEL SECURITY;

-- Todos pueden ver especialidades
CREATE POLICY "Specialty: Public read" ON "Specialty"
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Solo admins pueden crear/actualizar/eliminar
CREATE POLICY "Specialty: Admin insert" ON "Specialty"
  FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "Specialty: Admin update" ON "Specialty"
  FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Specialty: Admin delete" ON "Specialty"
  FOR DELETE
  USING (is_admin());

-- ==============================================================================
-- TABLA: Payment (si existe)
-- ==============================================================================
-- Crear tabla si no existe
CREATE TABLE IF NOT EXISTS "Payment" (
  "id" TEXT PRIMARY KEY,
  "amount" DOUBLE PRECISION NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3),
  "patientId" TEXT,
  "appointmentId" TEXT
);

ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;

-- Admins ven todos los pagos
CREATE POLICY "Payment: Admin see all" ON "Payment"
  FOR SELECT
  USING (is_admin());

-- Solo admins pueden crear/actualizar/eliminar
CREATE POLICY "Payment: Admin insert" ON "Payment"
  FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "Payment: Admin update" ON "Payment"
  FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Payment: Admin delete" ON "Payment"
  FOR DELETE
  USING (is_admin());

-- ==============================================================================
-- TABLA: Budget (si existe)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS "Budget" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT,
  "patientId" TEXT,
  "createdAt" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'DRAFT'
);

ALTER TABLE "Budget" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Budget: Admin see all" ON "Budget"
  FOR SELECT
  USING (is_admin());

CREATE POLICY "Budget: Admin insert" ON "Budget"
  FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "Budget: Admin update" ON "Budget"
  FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Budget: Admin delete" ON "Budget"
  FOR DELETE
  USING (is_admin());

-- ==============================================================================
-- TABLA: BudgetLineItem (si existe)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS "BudgetLineItem" (
  "id" TEXT PRIMARY KEY,
  "budgetId" TEXT,
  "description" TEXT,
  "amount" DOUBLE PRECISION
);

ALTER TABLE "BudgetLineItem" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "BudgetLineItem: Admin see all" ON "BudgetLineItem"
  FOR SELECT
  USING (is_admin());

CREATE POLICY "BudgetLineItem: Admin insert" ON "BudgetLineItem"
  FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "BudgetLineItem: Admin update" ON "BudgetLineItem"
  FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "BudgetLineItem: Admin delete" ON "BudgetLineItem"
  FOR DELETE
  USING (is_admin());

-- ==============================================================================
-- TABLA: Odontogram (si existe)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS "Odontogram" (
  "id" TEXT PRIMARY KEY,
  "patientId" TEXT,
  "teeth" JSONB,
  "createdAt" TIMESTAMP(3)
);

ALTER TABLE "Odontogram" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Odontogram: Admin see all" ON "Odontogram"
  FOR SELECT
  USING (is_admin());

CREATE POLICY "Odontogram: Doctor see patient's" ON "Odontogram"
  FOR SELECT
  USING (
    "patientId" IN (
      SELECT "id" FROM "Patient" WHERE "assignedDoctorId" IN (
        SELECT "id" FROM "Doctor" WHERE "id" IN (
          SELECT "doctorId" FROM "User" WHERE "id" = auth.uid()::TEXT
        )
      )
    )
  );

CREATE POLICY "Odontogram: Admin insert" ON "Odontogram"
  FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "Odontogram: Admin update" ON "Odontogram"
  FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Odontogram: Admin delete" ON "Odontogram"
  FOR DELETE
  USING (is_admin());

-- ==============================================================================
-- TABLA: DentalSnapshot (si existe)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS "DentalSnapshot" (
  "id" TEXT PRIMARY KEY,
  "patientId" TEXT,
  "snapshotData" JSONB,
  "createdAt" TIMESTAMP(3)
);

ALTER TABLE "DentalSnapshot" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "DentalSnapshot: Admin see all" ON "DentalSnapshot"
  FOR SELECT
  USING (is_admin());

CREATE POLICY "DentalSnapshot: Doctor see patient's" ON "DentalSnapshot"
  FOR SELECT
  USING (
    "patientId" IN (
      SELECT "id" FROM "Patient" WHERE "assignedDoctorId" IN (
        SELECT "id" FROM "Doctor" WHERE "id" IN (
          SELECT "doctorId" FROM "User" WHERE "id" = auth.uid()::TEXT
        )
      )
    )
  );

CREATE POLICY "DentalSnapshot: Admin insert" ON "DentalSnapshot"
  FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "DentalSnapshot: Admin update" ON "DentalSnapshot"
  FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "DentalSnapshot: Admin delete" ON "DentalSnapshot"
  FOR DELETE
  USING (is_admin());

-- ==============================================================================
-- TABLA: WhatsAppTemplate (si existe)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS "WhatsAppTemplate" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT,
  "content" TEXT,
  "createdAt" TIMESTAMP(3)
);

ALTER TABLE "WhatsAppTemplate" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "WhatsAppTemplate: Public read" ON "WhatsAppTemplate"
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "WhatsAppTemplate: Admin insert" ON "WhatsAppTemplate"
  FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "WhatsAppTemplate: Admin update" ON "WhatsAppTemplate"
  FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "WhatsAppTemplate: Admin delete" ON "WhatsAppTemplate"
  FOR DELETE
  USING (is_admin());

-- ==============================================================================
-- TABLA: WhatsAppLog (si existe)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS "WhatsAppLog" (
  "id" TEXT PRIMARY KEY,
  "phoneNumber" TEXT,
  "message" TEXT,
  "status" TEXT,
  "createdAt" TIMESTAMP(3)
);

ALTER TABLE "WhatsAppLog" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "WhatsAppLog: Admin see all" ON "WhatsAppLog"
  FOR SELECT
  USING (is_admin());

CREATE POLICY "WhatsAppLog: Admin insert" ON "WhatsAppLog"
  FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "WhatsAppLog: Admin update" ON "WhatsAppLog"
  FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "WhatsAppLog: Admin delete" ON "WhatsAppLog"
  FOR DELETE
  USING (is_admin());

-- ==============================================================================
-- TABLA: services (si existe)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS "services" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT,
  "price" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3)
);

ALTER TABLE "services" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "services: Public read" ON "services"
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "services: Admin insert" ON "services"
  FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "services: Admin update" ON "services"
  FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "services: Admin delete" ON "services"
  FOR DELETE
  USING (is_admin());

-- ==============================================================================
-- FIN DEL SCRIPT
-- ==============================================================================
-- 
-- Notas:
-- 1. RLS ahora está habilitado en todas las tablas públicas
-- 2. Las columnas sensibles (password, bank_account, etc.) están protegidas por políticas
-- 3. Solo los ADMIN pueden ver toda la información
-- 4. Los Doctores ven solo sus pacientes y datos relacionados
-- 5. Las políticas se evalúan según el role del usuario
-- 
-- Para ejecutar este script:
-- 1. Ve a tu panel de Supabase
-- 2. Abre el SQL Editor
-- 3. Copia y pega todo este contenido
-- 4. Haz clic en "Run" o ejecuta
-- 5. El linter debería mostrar 0 errores de seguridad

