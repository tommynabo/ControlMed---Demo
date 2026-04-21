#!/usr/bin/env node
/**
 * Find all Amaya records across tables
 * Diagnose duplicate invoice/payment/caja entries
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

async function main() {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.error('❌ Error: Credenciales no configuradas');
        process.exit(1);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    console.log('🔍 Buscando TODOS los registros de Amaya en la base de datos...\n');

    // Find Amaya patients
    const { data: patients } = await supabase
        .from('Patient')
        .select('id, name')
        .ilike('name', '%amaya%');

    if (!patients || patients.length === 0) {
        console.error('❌ No se encontró paciente Amaya');
        process.exit(1);
    }

    const patientIds = patients.map(p => p.id);
    console.log('📋 Pacientes encontrados:');
    patients.forEach(p => console.log(`   • ${p.name} (${p.id})`));

    // Check all tables
    const tables = [
        { name: 'Payment', filter: { patientId: patientIds } },
        { name: 'Invoice', filter: { patientId: patientIds } },
        { name: 'Appointment', filter: { patientId: patientIds } },
        { name: 'CashClosing', filter: { patientId: patientIds } },
        { name: 'CashRegister', filter: { patientId: patientIds } }
    ];

    for (const table of tables) {
        try {
            const { data, error } = await supabase
                .from(table.name)
                .select('*')
                .in('patientId', patientIds)
                .limit(50);

            if (error && error.code !== 'PGRST116') {
                console.log(`\n⚠️  Tabla ${table.name}: ${error.message}`);
                continue;
            }

            if (data && data.length > 0) {
                console.log(`\n📊 Tabla: ${table.name} (${data.length} registro(s))`);
                data.forEach((record, i) => {
                    console.log(`   ${i + 1}. ID: ${record.id}`);
                    if (record.amount) console.log(`      Importe: ${record.amount}€`);
                    if (record.patientId) {
                        const pat = patients.find(p => p.id === record.patientId);
                        console.log(`      Paciente: ${pat?.name}`);
                    }
                    if (record.createdAt) console.log(`      Fecha: ${new Date(record.createdAt).toLocaleString('es-ES')}`);
                    if (record.date) console.log(`      Fecha cita: ${record.date}`);
                    if (record.notes) console.log(`      Notas: ${record.notes}`);
                    if (record.concept) console.log(`      Concepto: ${record.concept}`);
                    if (record.status) console.log(`      Estado: ${record.status}`);
                });
            }
        } catch (e) {
            // Tabla no existe
        }
    }

    // Special search for invoices with amount 350 (2x175)
    console.log('\n\n🔎 Buscando facturas con importe 350€ (posible duplicado)...');
    const { data: invoices350 } = await supabase
        .from('Invoice')
        .select('*')
        .in('patientId', patientIds)
        .eq('amount', 350);

    if (invoices350 && invoices350.length > 0) {
        console.log(`\n⚠️  ENCONTRADAS ${invoices350.length} factura(s) de 350€:`);
        invoices350.forEach(inv => {
            console.log(`\n   📄 Factura ID: ${inv.id}`);
            console.log(`      Concepto: ${inv.concept || inv.items?.map(i => i.name).join(', ') || 'N/A'}`);
            console.log(`      Importe: ${inv.amount}€`);
            console.log(`      Fecha: ${inv.date ? new Date(inv.date).toLocaleString('es-ES') : 'N/A'}`);
            console.log(`      Estado: ${inv.status || 'N/A'}`);
            if (inv.items) {
                console.log(`      Conceptos:`);
                inv.items.forEach(item => {
                    console.log(`        - ${item.name}: ${item.price}€`);
                });
            }
        });
    }

    // Check for 175€ invoices
    console.log('\n\n🔎 Buscando facturas con importe 175€...');
    const { data: invoices175 } = await supabase
        .from('Invoice')
        .select('*')
        .in('patientId', patientIds)
        .eq('amount', 175);

    if (invoices175 && invoices175.length > 0) {
        console.log(`\n✅ Encontradas ${invoices175.length} factura(s) de 175€:`);
        invoices175.forEach((inv, i) => {
            console.log(`\n   ${i + 1}. ID: ${inv.id}`);
            console.log(`      Concepto: ${inv.concept || inv.items?.map(it => it.name).join(', ') || 'N/A'}`);
            console.log(`      Importe: ${inv.amount}€`);
            console.log(`      Fecha: ${inv.date ? new Date(inv.date).toLocaleString('es-ES') : 'N/A'}`);
            console.log(`      Estado: ${inv.status || 'N/A'}`);
        });
    }
}

main().catch(e => {
    console.error('❌ Error:', e.message);
    process.exit(1);
});
