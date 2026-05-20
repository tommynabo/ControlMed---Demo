// verify_deletion.js — Comprueba el estado actual de la BD tras el borrado
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, 'server', '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const CUTOFF = '2026-04-16T23:59:59.999Z';

async function countTable(table, dateField) {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .lte(dateField, CUTOFF);
  if (error) return `ERROR: ${error.message}`;
  return count;
}

async function countAll(table) {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true });
  if (error) return `ERROR: ${error.message}`;
  return count;
}

async function main() {
  console.log('=== VERIFICACIÓN DEL BORRADO (≤ 16 abril 2026) ===\n');

  const checks = [
    { table: 'Appointment',     dateField: 'date' },
    { table: 'ClinicalRecord',  dateField: 'date' },
    { table: 'Invoice',         dateField: 'date' },
    { table: 'Payment',         dateField: 'createdAt' },
    { table: 'Budget',          dateField: 'createdAt' },
    { table: 'PatientTreatment',dateField: 'createdAt' },
    { table: 'Liquidation',     dateField: 'createdAt' },
    { table: 'Patient',         dateField: 'createdAt' },
  ];

  let allClear = true;
  for (const { table, dateField } of checks) {
    const gone = await countTable(table, dateField);
    const total = await countAll(table);
    const ok = typeof gone === 'number' && gone === 0;
    if (!ok) allClear = false;
    const status = ok ? '✅' : '❌';
    console.log(`${status}  ${table.padEnd(20)} ≤ cutoff: ${String(gone).padStart(5)}   total: ${total}`);
  }

  console.log('\n');
  if (allClear) {
    console.log('✅  BORRADO COMPLETO — no quedan registros ≤ 16 abril 2026.');
    console.log('⚠️  Plan Free de Supabase: sin PITR. El snapshot diario (medianoche) ya fue sobreescrito.');
    console.log('    La única vía de recuperación son los CSV de DatosCompletosClinica/\n');
  } else {
    console.log('❌  Aún quedan registros ≤ 16 abril. Revisa las filas marcadas con ❌\n');
  }
}

main().catch(err => { console.error(err); process.exit(1); });
