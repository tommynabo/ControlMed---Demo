#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const PATIENT_ID = '5cce5565-30b6-43d4-89d8-dac9d0d6f7a9';
const DOCTOR_ID  = '25087aad-d3e0-484d-820d-f146a1ef283a';

async function main() {
  console.log('=== VERIFICACION FINAL AMAYA ESPIGA ===\n');

  const { data: invoices } = await supabase.from('Invoice').select('invoiceNumber,amount,concept,date,appointmentId').eq('patientId', PATIENT_ID).order('date');
  let invTotal = 0;
  console.log('FACTURAS:');
  invoices.forEach(i => { invTotal += i.amount; console.log('  ' + (i.invoiceNumber || i.id) + ' | ' + i.amount + 'EU | ' + i.concept + ' | cita:' + (i.appointmentId || 'sin cita')); });
  console.log('  TOTAL FACTURAS: ' + invTotal + 'EU\n');

  const { data: payments } = await supabase.from('Payment').select('id,amount,method,createdAt').eq('patientId', PATIENT_ID).order('createdAt');
  let pmtTotal = 0;
  console.log('PAGOS:');
  payments.forEach(p => { pmtTotal += p.amount; console.log('  ' + p.amount + 'EU ' + p.method + ' @ ' + new Date(p.createdAt).toLocaleDateString('es-ES')); });
  console.log('  TOTAL PAGOS: ' + pmtTotal + 'EU\n');

  const { data: appts } = await supabase.from('Appointment').select('id,date,status,paid,amount').eq('patientId', PATIENT_ID);
  console.log('CITAS BLANQUEAMIENTO:');
  appts.forEach(a => console.log('  ' + a.date + ' | status:' + a.status + ' | paid:' + a.paid + ' | importe:' + a.amount + 'EU'));

  const { data: liqs } = await supabase.from('Liquidation').select('id,grossAmount,finalAmount,commissionRate,treatmentName,createdAt').eq('doctorId', DOCTOR_ID);
  const blanqLiqs = liqs.filter(l => l.treatmentName && l.treatmentName.toLowerCase().includes('blanquea'));
  console.log('\nLIQUIDACIONES DOCTOR (blanqueamiento):');
  if (blanqLiqs.length === 0) {
    console.log('  NINGUNA');
  } else {
    blanqLiqs.forEach(l => console.log('  bruto:' + l.grossAmount + 'EU | doctor:' + l.finalAmount + 'EU (' + l.commissionRate + '%) | ' + l.treatmentName));
  }

  console.log('\n=== RESULTADO ===');
  const ok = invTotal === 350 && pmtTotal === 350 && blanqLiqs.length > 0;
  console.log('Facturas 350EU:', invTotal === 350 ? 'OK' : 'ERROR (' + invTotal + ')');
  console.log('Pagos 350EU:', pmtTotal === 350 ? 'OK' : 'ERROR (' + pmtTotal + ')');
  console.log('Liquidacion existe:', blanqLiqs.length > 0 ? 'OK' : 'ERROR - falta');
  console.log(ok ? '\nTODO CORRECTO' : '\nHAY PROBLEMAS');
}
main().catch(e => console.error(e.message));
