#!/usr/bin/env node
/**
 * Verify Amaya totals after deletion
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
    console.log('📊 VERIFICACIÓN DE TOTALES - AMAYA\n');

    const { data: patients } = await supabase
        .from('Patient')
        .select('id, name')
        .ilike('name', '%AMAYA ESPIGA%');

    if (!patients || patients.length === 0) {
        console.error('❌ Paciente no encontrado');
        process.exit(1);
    }

    const patientId = patients[0].id;
    console.log(`👤 Paciente: ${patients[0].name}\n`);

    // Get all invoices
    const { data: invoices } = await supabase
        .from('Invoice')
        .select('id, amount, date, concept, status')
        .eq('patientId', patientId)
        .order('date', { ascending: false });

    console.log('📄 FACTURAS:');
    let invoiceTotal = 0;
    if (invoices && invoices.length > 0) {
        invoices.forEach((inv, i) => {
            console.log(`   ${i + 1}. ${inv.concept || 'Sin concepto'}`);
            console.log(`      Importe: ${inv.amount}€ | Estado: ${inv.status}`);
            console.log(`      Fecha: ${new Date(inv.date).toLocaleDateString('es-ES')}`);
            invoiceTotal += inv.amount;
        });
    }
    console.log(`   ├─ TOTAL FACTURAS: ${invoiceTotal}€\n`);

    // Get all payments
    const { data: payments } = await supabase
        .from('Payment')
        .select('id, amount, createdAt, notes')
        .eq('patientId', patientId)
        .order('createdAt', { ascending: false });

    console.log('💰 PAGOS:');
    let paymentTotal = 0;
    if (payments && payments.length > 0) {
        payments.forEach((pmt, i) => {
            console.log(`   ${i + 1}. ${pmt.notes || 'Pago'}`);
            console.log(`      Importe: ${pmt.amount}€`);
            console.log(`      Fecha: ${new Date(pmt.createdAt).toLocaleDateString('es-ES')}`);
            paymentTotal += pmt.amount;
        });
    }
    console.log(`   ├─ TOTAL PAGOS: ${paymentTotal}€\n`);

    // Summary
    console.log('📋 RESUMEN:');
    console.log(`   Total Facturas: ${invoiceTotal}€`);
    console.log(`   Total Pagos:    ${paymentTotal}€`);
    const balance = invoiceTotal - paymentTotal;
    console.log(`   Diferencia:     ${balance}€ ${balance === 0 ? '✅ CUADRA' : `⚠️  DEUDA/PENDIENTE`}`);

    // Check for Friday (20/4/2026) specifics
    console.log(`\n📅 COBROS DEL VIERNES 20/4/2026:`);
    const fridayInvoices = (invoices || []).filter(i => i.date.startsWith('2026-04-20'));
    const fridayPayments = (payments || []).filter(p => new Date(p.createdAt).toISOString().split('T')[0] === '2026-04-20');
    
    let fridayInvoiceTotal = fridayInvoices.reduce((s, i) => s + i.amount, 0);
    let fridayPaymentTotal = fridayPayments.reduce((s, p) => s + p.amount, 0);

    console.log(`   Facturas: ${fridayInvoiceTotal}€`);
    console.log(`   Pagos:    ${fridayPaymentTotal}€`);
    console.log(`   Total:    ${fridayInvoiceTotal + fridayPaymentTotal}€ ✅`);
}

main().catch(e => {
    console.error('❌ Error:', e.message);
    process.exit(1);
});
