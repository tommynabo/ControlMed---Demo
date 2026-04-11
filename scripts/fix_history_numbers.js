'use strict';
const { createClient } = require('@supabase/supabase-js');
const { parse } = require('csv-parse/sync');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://gnnacijqglcqonholpwt.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) { console.error('Set SUPABASE_SERVICE_ROLE_KEY in .env'); process.exit(1); }

async function fixHistoryNumbers() {
  console.log('Fixing historyNumber: IDCONTACTO → real NUM...');

  const csvPath = path.join(__dirname, '..', 'BaseDatos', '61ecc3d7452276abae3b6a984cae43e8_37734_1774369609.csv');
  const raw = fs.readFileSync(csvPath, 'utf8');
  const rows = parse(raw, { delimiter: ';', columns: true, skip_empty_lines: true, relax_quotes: true, trim: true });

  // Count NUM occurrences (to handle duplicates)
  const numCount = {};
  for (const r of rows) {
    const num = (r['NUM'] || '').trim();
    if (num) numCount[num] = (numCount[num] || 0) + 1;
  }

  // Build IDCONTACTO → NUM map (only unique NUMs)
  const idToNum = new Map();
  for (const r of rows) {
    const id  = (r['IDCONTACTO'] || '').trim();
    const num = (r['NUM'] || '').trim();
    if (id && num && numCount[num] === 1) {
      idToNum.set(id, num);
    }
  }
  console.log(`CSV: ${idToNum.size} unique IDCONTACTO→NUM mappings`);

  // Fetch patients whose historyNumber looks like an IDCONTACTO (8-digit, starts with 3x/4x)
  const { data: patients, error } = await supabase
    .from('Patient')
    .select('id, name, historyNumber')
    .gte('historyNumber', '30000000')
    .lte('historyNumber', '39999999');

  if (error) { console.error('Fetch error:', error.message); process.exit(1); }
  console.log(`Patients with IDCONTACTO-style historyNumber: ${patients.length}`);

  let updated = 0, skipped = 0, conflicts = 0;

  for (const p of patients) {
    const correctNum = idToNum.get(p.historyNumber);
    if (!correctNum) {
      // IDCONTACTO not in CSV — leave as is (could be from a different import source)
      skipped++;
      continue;
    }

    // Verify no other patient already has correctNum as historyNumber
    const { data: conflict } = await supabase
      .from('Patient')
      .select('id')
      .eq('historyNumber', correctNum)
      .neq('id', p.id)
      .limit(1);

    if (conflict && conflict.length > 0) {
      console.log(`  CONFLICT: NUM="${correctNum}" already taken — skipping "${p.name}"`);
      conflicts++;
      continue;
    }

    const { error: updateErr } = await supabase
      .from('Patient')
      .update({ historyNumber: correctNum })
      .eq('id', p.id);

    if (updateErr) {
      console.log(`  ERROR updating ${p.name}: ${updateErr.message}`);
      skipped++;
    } else {
      updated++;
      if (updated % 50 === 0) process.stdout.write(`  Updated ${updated}...\n`);
    }
  }

  console.log(`\n✔ Done — Updated: ${updated} | Conflicts: ${conflicts} | Skipped: ${skipped}`);
}

fixHistoryNumbers().catch(console.error);
