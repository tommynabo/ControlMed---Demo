#!/usr/bin/env node
/**
 * Fix duplicate Amaya payment
 * Removes one of the two 175€ payments from Amaya
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
// Use SERVICE_ROLE_KEY to bypass RLS for admin operations
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

async function main() {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.error('❌ Error: Credenciales de Supabase no configuradas en .env');
        process.exit(1);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    console.log('🔍 Buscando pagos de Amaya de 175€...');
    
    // First, find patient Amaya
    const { data: patients, error: pErr } = await supabase
        .from('Patient')
        .select('id, name')
        .ilike('name', '%amaya%')
        .limit(10);
    
    if (pErr) {
        console.error('❌ Error buscando paciente:', pErr.message);
        process.exit(1);
    }

    if (!patients || patients.length === 0) {
        console.error('❌ No se encontró paciente con nombre similar a Amaya');
        process.exit(1);
    }

    console.log(`✅ Encontrados ${patients.length} paciente(s) con nombre similar a Amaya:`);
    patients.forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.name} (ID: ${p.id})`);
    });

    // Find payments for all matching patients
    const patientIds = patients.map(p => p.id);
    const { data: payments, error: pmtErr } = await supabase
        .from('Payment')
        .select('id, patientId, amount, notes, createdAt')
        .in('patientId', patientIds)
        .eq('amount', 175)
        .order('createdAt', { ascending: false });

    if (pmtErr) {
        console.error('❌ Error buscando pagos:', pmtErr.message);
        process.exit(1);
    }

    if (!payments || payments.length === 0) {
        console.log('❌ No se encontraron pagos de 175€ para Amaya');
        process.exit(0);
    }

    console.log(`\n💰 Encontrados ${payments.length} pago(s) de 175€:`);
    payments.forEach((p, i) => {
        const patient = patients.find(pt => pt.id === p.patientId);
        console.log(`\n   ${i + 1}. ID: ${p.id}`);
        console.log(`      Paciente: ${patient?.name}`);
        console.log(`      Importe: ${p.amount}€`);
        console.log(`      Notas: ${p.notes || 'N/A'}`);
        console.log(`      Fecha: ${new Date(p.createdAt).toLocaleString('es-ES')}`);
    });

    if (payments.length === 1) {
        console.log('\n✅ Solo hay un pago de 175€. No hay duplicado que eliminar.');
        process.exit(0);
    }

    // Ask which one to delete
    if (payments.length > 1) {
        console.log(`\n⚠️  Se encontraron ${payments.length} pagos de 175€.`);
        console.log('   El más antiguo será eliminado (se asume que es el duplicado).');
        
        const toDelete = payments[payments.length - 1]; // El más antiguo
        
        console.log(`\n🗑️  Eliminando pago ID: ${toDelete.id}`);
        console.log(`   Paciente: ${patients.find(p => p.id === toDelete.patientId)?.name}`);
        console.log(`   Importe: ${toDelete.amount}€`);
        console.log(`   Fecha: ${new Date(toDelete.createdAt).toLocaleString('es-ES')}`);

        const { error: delErr } = await supabase
            .from('Payment')
            .delete()
            .eq('id', toDelete.id);

        if (delErr) {
            console.error('❌ Error al eliminar pago:', delErr.message);
            process.exit(1);
        }

        console.log('\n✅ Pago duplicado eliminado correctamente!');

        // Show updated payments
        const { data: updatedPayments } = await supabase
            .from('Payment')
            .select('id, patientId, amount, notes, createdAt')
            .in('patientId', patientIds)
            .eq('amount', 175);

        const total = (updatedPayments || []).reduce((s, p) => s + p.amount, 0);
        console.log(`\n📊 Total de pagos de 175€ ahora: ${updatedPayments?.length || 0}`);
        console.log(`   Total en euros: ${total}€`);
    }
}

main().catch(e => {
    console.error('❌ Error:', e.message);
    process.exit(1);
});
