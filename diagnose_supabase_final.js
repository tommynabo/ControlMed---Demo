#!/usr/bin/env node

/**
 * Script de diagnóstico: Usa Supabase Client con NODE_TLS_REJECT_UNAUTHORIZED
 * Ejecutar con: node diagnose_supabase_final.js
 */

// IMPORTANT: Disable SSL verification for development only
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

require('dotenv').config({ path: './.env' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const SUPABASE_URL = process.env.SUPABASE_URL;
let SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Si SERVICE_ROLE_KEY parece corrupta, usar ANON_KEY
if (!SUPABASE_KEY || !SUPABASE_KEY.includes('.')) {
    console.log('⚠️  SERVICE_ROLE_KEY corrupta o no disponible, usando ANON_KEY\n');
    SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
}

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Error: SUPABASE_URL o claves no encontradas');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
    try {
        console.log('========================================');
        console.log('   DIAGNÓSTICO DE CITAS DUPLICADAS');
        console.log('========================================\n');

        // Get today's date in YYYY-MM-DD format
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        
        console.log(`📅 Buscando citas duplicadas para: ${todayStr}\n`);
        console.log('Conectando a Supabase...\n');

        // Get all appointments for today with relations
        const { data: allAppointments, error: fetchError } = await supabase
            .from('Appointment')
            .select(`
                id, 
                date, 
                time, 
                patientId, 
                doctorId,
                patient:Patient(name),
                doctor:Doctor(name),
                status
            `)
            .gte('date', todayStr + 'T00:00:00')
            .lte('date', todayStr + 'T23:59:59')
            .is('deleted_at', null)
            .order('time', { ascending: true });

        if (fetchError) {
            console.error('❌ Error fetching appointments:', fetchError.message);
            process.exit(1);
        }

        console.log(`📊 Total de citas para hoy: ${allAppointments.length}\n`);

        if (allAppointments.length === 0) {
            console.log('✅ No hay citas para hoy\n');
            return;
        }

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

        console.log(`⚠️  Se encontraron ${duplicates.length} GRUPOS de citas duplicadas:\n`);
        console.log('─'.repeat(150));

        const toDelete = [];

        duplicates.forEach(([key, appts], idx) => {
            const [doctorId, patientId, time] = key.split('|');
            const docName = appts[0].doctor?.name || 'Sin doctor';
            const patientName = appts[0].patient?.name || 'Sin paciente';
            const dup_count = appts.length;

            console.log(`\n${idx + 1}. Dr/Dra. ${docName} | Paciente: ${patientName} | Hora: ${time}`);
            console.log(`   ⚠️  Total de DUPLICADOS: ${dup_count}`);
            console.log('   Registros encontrados:');

            // Keep first, delete rest (as they're sorted by query)
            const sorted = [...appts];

            sorted.forEach((appt, i) => {
                const isOldest = i === 0;
                const marker = isOldest ? '✓ MANTENER' : '✗ ELIMINAR';
                console.log(`      [${marker}] ID: ${appt.id.slice(0, 8)}... | Status: ${appt.status}`);
                
                if (!isOldest) {
                    toDelete.push(appt.id);
                }
            });
        });

        console.log('\n' + '─'.repeat(150));
        console.log(`\n📊 RESUMEN FINAL:`);
        console.log(`   • Total de citas hoy: ${allAppointments.length}`);
        console.log(`   • Grupos con duplicados: ${duplicates.length}`);
        console.log(`   • Registros a ELIMINAR: ${toDelete.length}`);
        console.log(`   • Registros a MANTENER: ${allAppointments.length - toDelete.length}`);

        if (toDelete.length > 0) {
            // Save to file
            fs.writeFileSync('duplicates_to_delete.json', JSON.stringify(toDelete, null, 2));
            console.log(`\n✅ IDs para eliminar guardados en: duplicates_to_delete.json`);
            
            console.log(`\n💾 REGISTROS A ELIMINAR (${toDelete.length} total):\n`);
            toDelete.forEach((id, i) => {
                console.log(`   ${i + 1}. ${id}`);
            });
        }

        console.log('\n✅ Diagnóstico completado');
        console.log('\n⏭️  PRÓXIMO PASO: Ejecutar "node remove_duplicates_supabase.js" para ELIMINAR\n');

    } catch (e) {
        console.error('❌ Error:', e.message);
        console.error(e);
        process.exit(1);
    }
}

main();
