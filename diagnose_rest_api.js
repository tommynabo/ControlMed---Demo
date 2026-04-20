#!/usr/bin/env node

/**
 * Script de diagnóstico: Usa API REST de Supabase directamente con fetch
 * Ejecutar con: node diagnose_rest_api.js
 */

require('dotenv').config({ path: './.env' });
const https = require('https');
const fs = require('fs');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('❌ Error: SUPABASE_URL o SUPABASE_ANON_KEY no encontrados');
    process.exit(1);
}

// Create HTTPS agent that ignores SSL verification
const agent = new https.Agent({
    rejectUnauthorized: false
});

async function fetchFromSupabase(query) {
    return new Promise((resolve, reject) => {
        const url = `${SUPABASE_URL}/rest/v1/Appointment?select=id,date,time,patientId,doctorId,status,created_at&deleted_at=is.null&order=time.asc&date=gte.${query.date}T00:00:00&date=lte.${query.date}T23:59:59`;
        
        const options = {
            headers: {
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'apikey': SUPABASE_ANON_KEY,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            agent: agent
        };

        https.get(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode !== 200) {
                    reject(new Error(`Status ${res.statusCode}: ${data}`));
                } else {
                    resolve(JSON.parse(data || '[]'));
                }
            });
        }).on('error', reject);
    });
}

async function main() {
    try {
        console.log('========================================');
        console.log('   DIAGNÓSTICO DE CITAS DUPLICADAS');
        console.log('========================================\n');

        // Get today's date in YYYY-MM-DD format
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        
        console.log(`📅 Buscando citas duplicadas para: ${todayStr}\n`);
        console.log('Conectando a Supabase via API REST...\n');

        // Fetch appointments
        const allAppointments = await fetchFromSupabase({ date: todayStr });

        console.log(`📊 Total de citas para hoy: ${allAppointments.length}\n`);

        if (allAppointments.length === 0) {
            console.log('✅ No hay citas para hoy\n');
            return;
        }

        // Group by (doctorId, patientId, time) to find duplicates
        const grouped = {};
        allAppointments.forEach(appt => {
            const key = `${appt.doctorid}|${appt.patientid}|${appt.time}`;
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

            console.log(`\n${idx + 1}. Doctor ID: ${doctorId} | Paciente ID: ${patientId} | Hora: ${time}`);
            console.log(`   ⚠️  Total de DUPLICADOS: ${appts.length}`);
            console.log('   Registros encontrados:');

            // Sort by created_at to keep the oldest
            const sorted = [...appts].sort((a, b) => 
                new Date(a.created_at) - new Date(b.created_at)
            );

            sorted.forEach((appt, i) => {
                const isOldest = i === 0;
                const marker = isOldest ? '✓ MANTENER' : '✗ ELIMINAR';
                const created = new Date(appt.created_at).toLocaleString('es-ES');
                console.log(`      [${marker}] ID: ${appt.id.slice(0, 8)}... | Creada: ${created} | Status: ${appt.status}`);
                
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
        console.log('\n⏭️  PRÓXIMO PASO: Ejecutar "node remove_duplicates_final.js" para ELIMINAR\n');

    } catch (e) {
        console.error('❌ Error:', e.message);
        process.exit(1);
    }
}

main();
