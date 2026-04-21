#!/usr/bin/env node
/**
 * Verify total payments for Friday 20/4/2026
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
    console.log('📅 COBROS DEL VIERNES 20/4/2026 (TODO EL SISTEMA)\n');

    // Get all payments from Friday
    const { data: fridayPayments } = await supabase
        .from('Payment')
        .select('id, patientId, amount, notes, createdAt')
        .gte('createdAt', '2026-04-20T00:00:00')
        .lte('createdAt', '2026-04-20T23:59:59')
        .order('createdAt', { ascending: false });

    if (!fridayPayments || fridayPayments.length === 0) {
        console.log('No hay pagos registrados para el viernes 20/4/2026');
        process.exit(0);
    }

    // Get patient names for display
    const patientIds = [...new Set(fridayPayments.map(p => p.patientId).filter(Boolean))];
    const { data: patients } = await supabase
        .from('Patient')
        .select('id, name')
        .in('id', patientIds);

    const patientMap = {};
    (patients || []).forEach(p => { patientMap[p.id] = p.name; });

    console.log(`✅ Encontrados ${fridayPayments.length} pago(s)\n`);
    console.log('DETALLE:');
    
    let total = 0;
    fridayPayments.forEach((pmt, i) => {
        const patient = patientMap[pmt.patientId] || 'Desconocido';
        console.log(`\n   ${i + 1}. ${patient}`);
        console.log(`      Importe: ${pmt.amount}€`);
        console.log(`      Hora: ${new Date(pmt.createdAt).toLocaleTimeString('es-ES')}`);
        console.log(`      Notas: ${pmt.notes || 'N/A'}`);
        total += pmt.amount;
    });

    console.log(`\n${'═'.repeat(50)}`);
    console.log(`\n💰 TOTAL COBROS (Viernes 20/4/2026): ${total}€\n`);

    if (total === 585) {
        console.log('✅ Los totales cuadran correctamente: 585€');
    } else if (total === 760) {
        console.log(`⚠️  El total sigue siendo 760€. Hay ${total - 585}€ de diferencia.`);
        console.log('   Esto sugiere que aún hay un duplicado no eliminado.');
    } else {
        console.log(`⚠️  El total es ${total}€ (diferencia: ${total - 585}€)`);
    }
}

main().catch(e => {
    console.error('❌ Error:', e.message);
    process.exit(1);
});
