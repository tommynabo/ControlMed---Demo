import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const query = `
    CREATE TABLE IF NOT EXISTS "public"."agenda_closures" (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
      closure_date DATE NOT NULL,
      doctor_id UUID REFERENCES auth.users(id),
      reason TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
      created_by UUID REFERENCES auth.users(id)
    );

    ALTER TABLE "public"."agenda_closures" ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "closures_read_all" ON "public"."agenda_closures";
    CREATE POLICY "closures_read_all" ON "public"."agenda_closures" FOR SELECT USING (true);

    DROP POLICY IF EXISTS "closures_insert" ON "public"."agenda_closures";
    CREATE POLICY "closures_insert" ON "public"."agenda_closures" FOR INSERT WITH CHECK (true);

    DROP POLICY IF EXISTS "closures_delete" ON "public"."agenda_closures";
    CREATE POLICY "closures_delete" ON "public"."agenda_closures" FOR DELETE USING (true);
  `;
  // the JS client doesn't support raw queries out of the box...
  // Usually to run raw SQL using @supabase/supabase-js we rely on an rpc function.
}
run();
