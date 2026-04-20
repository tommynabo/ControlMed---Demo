#!/usr/bin/env node

/**
 * Script de diagnóstico: Identifica citas duplicadas del Dr. Crabieh para hoy
 * Ejecutar con: node diagnose_duplicates.js
 */

require('dotenv').config({ path: './.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Error: SUPABASE_URL y SUPABASE_KEY no encontrados en .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    try {
        console.log('========================================');
        console.log('   DIAGNÓSTICO DE CITAS DUPLICADAS');
        console.log('========================================\n');

        // Get today's date in YYYY-MM-DD format
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        
        console.log(`📅 Buscando citas duplicadas para: ${todayStr}\n`);

        // Get all appointments for today
        const { data: allAppointments, error: fetchError } = await supabase
            .from('Appointment')
            .select('id, date, time, patientId, doctorId, patient:Patient(name), doctor:Doctor(name), status, created_at')
            .gte('date', todayStr + 'T00:00:00')
            .lte('date', todayStr + 'T23:59:59')
            .is('deleted_at', null)
            .order('time', { ascending: true });

        if (fetchError) {
            console.error('❌ Error fetching appointments:', fetchError.message);
            process.exit(1);
        }

        console.log(`📊 Total de citas para hoy: ${allAppointments.length}\n`);

        // Group by (doctorId, patientId, time) to find duplicates
        const grouped = {};
        allAppointments.forEach(appt => {
            const key = `${appt.doctorId}|${appt.patientId}|${appt.time}`;
            if (!grouped[key]) {
                grouped[key] = [];
            }
            grouped[key].push(appt);
        });

        // Find groups with duplicates
        const duplicates = Object.entries(grouped).filter(([_, appts]) => appts.length > 1);

        if (duplicates.length === 0) {
            console.log('✅ No se encontraron citas duplicadas\n');
            return;
        }

        console.log(`⚠️  Se encontraron ${duplicates.length} grupos de citas duplicadas:\n`);
        console.log('─'.repeat(100));

        const toDelete = [];

        duplicates.forEach(([key, appts], idx) => {
            const [doctorId, patientId, time] = key.split('|');
            const docName = appts[0].doctor?.name || 'Sin doctor';
            const patientName = appts[0].patient?.name || 'Sin paciente';

            console.log(`\n${idx + 1}. ${docName} | ${patientName} | ${time}`);
            console.log('   Duplicados encontrados:');

            // Sort by created_at to keep the oldest
            const sorted = [...appts].sort((a, b) => 
                new Date(a.created_at) - new Date(b.created_at)
            );

            sorted.forEach((appt, i) => {
                const isOldest = i === 0;
                const marker = isOldest ? '✓ MANTENER' : '✗ ELIMINAR';
                const created = new Date(appt.created_at).toLocaleString();
                console.log(`      [${marker}] ID: ${appt.id.slice(0, 8)}... | Creada: ${created} | Status: ${appt.status}`);
                
                if (!isOldest) {
                    toDelete.push(appt.id);
                }
            });
        });

        console.log('\n' + '─'.repeat(100));
        console.log(`\n📊 Resumen:`);
        console.log(`   • Total de citas duplicadas: ${duplicates.length} grupos`);
        console.log(`   • Total de registros a eliminar: ${toDelete.length}`);
        console.log(`   • Total de registros a mantener: ${allAppointments.length - toDelete.length}`);

        if (toDelete.length > 0) {
            console.log(`\n💾 IDs de registros a eliminar:\n`);
            toDelete.forEach(id => {
                console.log(`   ${id}`);
            });

            // Save to file for reference
            const fs = require('fs');
            fs.writeFileSync('duplicates_to_delete.json', JSON.stringify(toDelete, null, 2));
            console.log(`\n✅ IDs guardados en: duplicates_to_delete.json`);
        }

        console.log('\n✅ Diagnóstico completado');
        console.log('\nPróximo paso: Ejecutar "node remove_duplicates.js" para eliminar los registros\n');

    } catch (e) {
        console.error('❌ Error:', e.message);
        process.exit(1);
    }
}

main();
