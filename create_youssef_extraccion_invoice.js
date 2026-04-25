#!/usr/bin/env node
/**
 * Crear la factura correcta de Youssef: "Extracción Simple - Diente 14" 60€ card 23/04/2026
 * La factura incorrecta (F-2026-1776705517433 "Primera Visita") ya fue eliminada.
 */

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Datos confirmados del diagnóstico
const PATIENT_ID    = '97d68315-8a99-4faa-aa4a-8f93624a09aa'; // Youssef el kabouri
const APPT_ID       = '968e1f6d-a862-482b-b832-c476f73c93a3'; // Extracción Simple - Diente 14
const DOCTOR_ID     = '25087aad-d3e0-484d-820d-f146a1ef283a'; // Dr. CHRABIEH
const AMOUNT        = 60;
const METHOD        = 'card';
const CONCEPT       = 'Extracción Simple - Diente 14';
const TARGET_DATE   = '2026-04-23T12:00:00.000Z';

async function main() {
    console.log('══════════════════════════════════════════════════');
    console.log('  CREAR FACTURA: EXTRACCIÓN SIMPLE YOUSSEF');
    console.log('══════════════════════════════════════════════════\n');

    // Verificar que no exista ya una factura para esta cita
    const { data: existingInv } = await supabase
        .from('Invoice')
        .select('id, invoiceNumber, concept')
        .eq('appointmentId', APPT_ID);

    if (existingInv && existingInv.length > 0) {
        console.log('⚠️  Ya existe una factura para esta cita:');
        existingInv.forEach(i => console.log(`   ${i.invoiceNumber} — ${i.concept}`));
        console.log('\nNo se ha creado nada para evitar duplicados.');
        return;
    }

    // Generar número de factura secuencial
    const year = new Date().getFullYear();
    const prefix = `F-${year}-`;
    const { data: existing } = await supabase
        .from('Invoice')
        .select('invoiceNumber')
        .ilike('invoiceNumber', `${prefix}%`);

    const maxNum = (existing || []).reduce((max, inv) => {
        const num = parseInt(inv.invoiceNumber.slice(prefix.length), 10);
        return isNaN(num) ? max : Math.max(max, num);
    }, 0);
    const invoiceNumber = `${prefix}${String(maxNum + 1).padStart(4, '0')}`;

    const paymentId = crypto.randomUUID();
    const invoiceId = crypto.randomUUID();

    // 1. Crear Payment (sin invoiceId aún)
    console.log('1️⃣  Creando Payment...');
    const { error: payErr } = await supabase
        .from('Payment')
        .insert([{
            id: paymentId,
            patientId: PATIENT_ID,
            amount: AMOUNT,
            method: METHOD,
            type: 'DIRECT_CHARGE',
            doctorId: DOCTOR_ID,
            referralCommission: 0,
            createdAt: new Date(TARGET_DATE).toISOString()
        }]);
    if (payErr) { console.error('❌ Error:', payErr.message); process.exit(1); }
    console.log(`   ✅ Payment creado: ${paymentId}`);

    // 2. Crear Invoice
    console.log('2️⃣  Creando Invoice...');
    const { error: invErr } = await supabase
        .from('Invoice')
        .insert([{
            id: invoiceId,
            invoiceNumber,
            patientId: PATIENT_ID,
            amount: AMOUNT,
            date: new Date(TARGET_DATE).toISOString(),
            status: 'issued',
            paymentMethod: METHOD,
            concept: CONCEPT,
            appointmentId: APPT_ID,
            relatedPaymentId: paymentId
        }]);
    if (invErr) { console.error('❌ Error:', invErr.message); process.exit(1); }
    console.log(`   ✅ Invoice creado: ${invoiceNumber}`);

    // 3. Actualizar Payment con invoiceId
    console.log('3️⃣  Vinculando Payment → Invoice...');
    const { error: updErr } = await supabase
        .from('Payment')
        .update({ invoiceId })
        .eq('id', paymentId);
    if (updErr) console.warn('   ⚠️  No se pudo vincular (no crítico):', updErr.message);
    else console.log('   ✅ Vinculado correctamente');

    // 4. Crear InvoiceItem
    console.log('4️⃣  Creando InvoiceItem...');
    const { error: itemErr } = await supabase
        .from('InvoiceItem')
        .insert([{ id: crypto.randomUUID(), invoiceId, name: CONCEPT, price: AMOUNT }]);
    if (itemErr) console.warn('   ⚠️  InvoiceItem no creado:', itemErr.message);
    else console.log('   ✅ InvoiceItem creado');

    // 5. Crear Liquidación
    console.log('5️⃣  Creando Liquidación para Dr. CHRABIEH...');
    const { data: doctor } = await supabase.from('Doctor').select('commissionPercentage').eq('id', DOCTOR_ID).single();
    const commRate = doctor?.commissionPercentage || 30;
    const finalAmount = AMOUNT * (commRate / 100);

    const { error: liqErr } = await supabase
        .from('Liquidation')
        .insert([{
            id: crypto.randomUUID(),
            doctorId: DOCTOR_ID,
            appointmentId: APPT_ID,
            grossAmount: AMOUNT,
            baseAmount: AMOUNT,
            labCost: 0,
            commissionRate: commRate,
            finalAmount,
            referralCommission: 0,
            treatmentName: CONCEPT,
            patientName: 'Youssef el kabouri',
            paymentMethod: METHOD,
            status: 'PENDING',
            createdAt: new Date().toISOString()
        }]);
    if (liqErr) console.warn('   ⚠️  Liquidación no creada:', liqErr.message);
    else console.log(`   ✅ Liquidación creada (${commRate}% = ${finalAmount.toFixed(2)}€)`);

    // 6. Marcar la cita de Extracción como pagada
    console.log('6️⃣  Confirmando cita como pagada...');
    const { error: apptErr } = await supabase
        .from('Appointment')
        .update({ paid: true, status: 'Completed' })
        .eq('id', APPT_ID);
    if (apptErr) console.warn('   ⚠️  Error al actualizar cita:', apptErr.message);
    else console.log('   ✅ Cita marcada como pagada');

    console.log('\n══════════════════════════════════════════════════');
    console.log('  ✅ COMPLETADO');
    console.log('══════════════════════════════════════════════════');
    console.log(`\n  Factura creada: ${invoiceNumber}`);
    console.log(`  Concepto:       ${CONCEPT}`);
    console.log(`  Importe:        ${AMOUNT}€ (${METHOD})`);
    console.log(`  Fecha en caja:  23/04/2026`);
    console.log(`  Doctor:         Dr. CHRABIEH`);
    console.log('\n  → Recarga la caja del 23 de abril para verificar.');
}

main().catch(e => {
    console.error('❌ Error:', e.message);
    process.exit(1);
});
