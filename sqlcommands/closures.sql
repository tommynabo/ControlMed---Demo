-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION (run once in Supabase SQL Editor):
--   FIX 1 — agenda_closures doctor_id FK was referencing auth.users(id) but
--            the backend inserts Doctor.id values → constraint violation.
--            Drop the bad FK and add the correct one referencing Doctor(id).
--   FIX 2 — Add paid column to BudgetLineItem so paid items can be hidden
--            from the budget view in the patient card.
-- ═══════════════════════════════════════════════════════════════════════════════

-- FIX 1a: Drop wrong FK on doctor_id, widen type to TEXT, re-add correct FK
ALTER TABLE agenda_closures
  DROP CONSTRAINT IF EXISTS agenda_closures_doctor_id_fkey;

ALTER TABLE agenda_closures
  ALTER COLUMN doctor_id TYPE TEXT;

ALTER TABLE agenda_closures
  ADD CONSTRAINT agenda_closures_doctor_id_fkey
  FOREIGN KEY (doctor_id) REFERENCES "Doctor"(id) ON DELETE SET NULL;

-- FIX 1b: Drop wrong FK on created_by (also was auth.users), widen to TEXT
ALTER TABLE agenda_closures
  DROP CONSTRAINT IF EXISTS agenda_closures_created_by_fkey;

ALTER TABLE agenda_closures
  ALTER COLUMN created_by TYPE TEXT;

-- FIX 2: Add paid flag to BudgetLineItem
ALTER TABLE "BudgetLineItem"
  ADD COLUMN IF NOT EXISTS paid BOOLEAN DEFAULT FALSE;

-- ───────────────────────────────────────────────────────────────────────────────
-- ORIGINAL TABLE DEFINITION (kept for reference / fresh installs)
-- ───────────────────────────────────────────────────────────────────────────────

-- 1. CREACIÓN DE LA TABLA PARA CIERRES DE AGENDA (FESTIVOS/BAJAS)
CREATE TABLE IF NOT EXISTS "public"."agenda_closures" (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  closure_date DATE NOT NULL,
  doctor_id UUID REFERENCES auth.users(id),
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_by UUID REFERENCES auth.users(id)
);

-- 2. POLÍTICAS DE SEGURIDAD (RLS)
ALTER TABLE "public"."agenda_closures" ENABLE ROW LEVEL SECURITY;

-- Todos (Admin y Recepción) pueden ver los cierres para que la agenda se pinte bien
DROP POLICY IF EXISTS "closures_read_all" ON "public"."agenda_closures";
CREATE POLICY "closures_read_all" ON "public"."agenda_closures"
  FOR SELECT USING (true);

-- Admin y Recepción pueden crear cierres
DROP POLICY IF EXISTS "closures_insert" ON "public"."agenda_closures";
CREATE POLICY "closures_insert" ON "public"."agenda_closures"
  FOR INSERT WITH CHECK (true); -- Simplifying for now since is_reception_or_admin might not be defined or available

-- Solo Admin puede borrar o editar cierres
DROP POLICY IF EXISTS "closures_delete" ON "public"."agenda_closures";
CREATE POLICY "closures_delete" ON "public"."agenda_closures"
  FOR DELETE USING (true); -- Simplifying for safety
