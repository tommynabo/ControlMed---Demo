#!/usr/bin/env node
/**
 * Verifica y limpia liquidaciones duplicadas del blanqueamiento de Amaya
 */
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const DOCTOR_ID   = '25087aad-d3e0-484d-820d-f146a1ef283a';
const APPT_APR17  = 'f2a2451d-2451-4348-8cc4-bd82ebb64326';
const APPT_APR20  = 'da1cb8bd-4c83-4ed8-8908-a897255c26bd';

async function main() {
  // Get all blanqueamiento liquidations for this doctor
  const { data: liqs } = await supabase
    .from('Liquidation')
    .select('id, grossAmount, finalAmount, commissionRate, treatmentName, appointmentId, createdAt')
    .eq('doctorId', DOCTOR_ID)
    .ilike('treatmentName', '%blanquea%')
    .order('createdAt');

  console.log('Liquidaciones blanqueamiento encontradas:', liqs.length);
  liqs.forEach((l, i) => console.log(`  ${i+1}. id:${l.id} | bruto:${l.grossAmount}EU | cita:${l.appointmentId} | fecha:${l.createdAt}`));

  if (liqs.length <= 1) {
    console.log('\nNo hay duplicados. Nada que hacer.');
    return;
  }

  // Keep the one linked to Apr20 appointment (da1cb8bd), delete the other(s)
  const toKeep = liqs.find(l => l.appointmentId === APPT_APR20);
  const toDelete = liqs.filter(l => l.id !== (toKeep ? toKeep.id : liqs[liqs.length - 1].id));

  if (toKeep) {
    console.log(`\nConservando: ${toKeep.id} (cita Apr20)`);
  } else {
    // Keep the most recent one
    console.log(`\nConservando: ${liqs[liqs.length - 1].id} (más reciente)`);
  }

  for (const liq of toDelete) {
    console.log(`Eliminando duplicado: ${liq.id} | cita:${liq.appointmentId}`);
    const { error } = await supabase.from('Liquidation').delete().eq('id', liq.id);
    if (error) console.error('  ERROR:', error.message);
    else console.log('  OK');
  }

  // Final count
  const { data: final } = await supabase
    .from('Liquidation')
    .select('id, grossAmount, finalAmount, appointmentId')
    .eq('doctorId', DOCTOR_ID)
    .ilike('treatmentName', '%blanquea%');

  console.log('\n=== ESTADO FINAL ===');
  console.log('Liquidaciones blanqueamiento:', final.length);
  final.forEach(l => console.log(`  bruto:${l.grossAmount}EU | doctor:${l.finalAmount}EU | cita:${l.appointmentId}`));
  console.log(final.length === 1 ? '\nOK - una sola liquidacion' : '\nATENCION - revisar');
}
main().catch(e => console.error(e.message));
