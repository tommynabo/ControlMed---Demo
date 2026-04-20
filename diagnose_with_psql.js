#!/usr/bin/env node

/**
 * Script de diagnóstico: Identifica citas duplicadas usando psql
 * Ejecutar con: node diagnose_with_psql.js
 */

require('dotenv').config({ path: './.env' });
const { execSync } = require('child_process');
const fs = require('fs');

let DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error('❌ Error: DATABASE_URL no encontrado en .env');
    process.exit(1);
}

// Clean up DATABASE_URL - remove pgbouncer parameter
DATABASE_URL = DATABASE_URL.replace('&pgbouncer=true', '');

async function main() {
    try {
        console.log('========================================');
        console.log('   DIAGNÓSTICO DE CITAS DUPLICADAS');
        console.log('========================================\n');

        // Get today's date in YYYY-MM-DD format
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        
        console.log(`📅 Buscando citas duplicadas para: ${todayStr}\n`);

        // Query to find duplicates
        const query = `
            SELECT 
                a.id, 
                a.date::date, 
                a.time, 
                a.patientId, 
                a.doctorId,
                p.name as patient_name,
                d.name as doctor_name,
                a.status,
                a.created_at,
                ROW_NUMBER() OVER (PARTITION BY a.doctorId, a.patientId, a.time ORDER BY a.created_at) as rn,
                COUNT(*) OVER (PARTITION BY a.doctorId, a.patientId, a.time) as dup_count
            FROM "Appointment" a
            LEFT JOIN "Patient" p ON a.patientId = p.id
            LEFT JOIN "Doctor" d ON a.doctorId = d.id
            WHERE DATE(a.date) = '${todayStr}'
            AND a.deleted_at IS NULL
            ORDER BY a.doctorId, a.time, a.created_at;
        `;

        // Execute query with psql
        const cmd = `psql '${DATABASE_URL}' -t -A -F '|' -c "${query.replace(/"/g, '\\"')}"`;
        
        console.log('Conectando a la BD...\n');
        const output = execSync(cmd, { encoding: 'utf-8' });
        
        if (!output.trim()) {
            console.log('✅ No hay citas para hoy\n');
            return;
        }

        const rows = output.trim().split('\n').map(line => {
            const parts = line.split('|');
            return {
                id: parts[0],
                date: parts[1],
                time: parts[2],
                patientId: parts[3],
                doctorId: parts[4],
                patient_name: parts[5],
                doctor_name: parts[6],
                status: parts[7],
                created_at: parts[8],
                rn: parseInt(parts[9]),
                dup_count: parseInt(parts[10])
            };
        });

        console.log(`📊 Total de citas para hoy: ${rows.length}\n`);

        // Find groups with duplicates
        const byKey = {};
        rows.forEach(row => {
            const key = `${row.doctorId}|${row.patientId}|${row.time}`;
            if (!byKey[key]) {
                byKey[key] = [];
            }
            byKey[key].push(row);
        });

        const duplicates = Object.entries(byKey).filter(([_, appts]) => appts.length > 1);

        if (duplicates.length === 0) {
            console.log('✅ No se encontraron citas duplicadas\n');
            return;
        }

        console.log(`⚠️  Se encontraron ${duplicates.length} grupos de citas duplicadas:\n`);
        console.log('─'.repeat(150));

        const toDelete = [];

        duplicates.forEach(([key, appts], idx) => {
            const [doctorId, patientId, time] = key.split('|');
            const docName = appts[0].doctor_name || 'Sin doctor';
            const patientName = appts[0].patient_name || 'Sin paciente';

            console.log(`\n${idx + 1}. ${docName} | ${patientName} | ${time}`);
            console.log(`   ${appts.length} duplicados encontrados:`);

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
        console.log(`\n📊 RESUMEN:`);
        console.log(`   • Total de citas: ${rows.length}`);
        console.log(`   • Grupos con duplicados: ${duplicates.length}`);
        console.log(`   • Registros a ELIMINAR: ${toDelete.length}`);
        console.log(`   • Registros a MANTENER: ${rows.length - toDelete.length}`);

        if (toDelete.length > 0) {
            // Save to file
            fs.writeFileSync('duplicates_to_delete.json', JSON.stringify(toDelete, null, 2));
            console.log(`\n✅ IDs para eliminar guardados en: duplicates_to_delete.json`);
            
            console.log(`\n💾 Registros a eliminar:\n`);
            toDelete.forEach((id, i) => {
                console.log(`   ${i + 1}. ${id}`);
            });
        }

        console.log('\n✅ Diagnóstico completado');
        console.log('\nPróximo paso: Ejecutar "node remove_duplicates_sql.js" para ELIMINAR\n');

    } catch (e) {
        console.error('❌ Error:', e.message);
        process.exit(1);
    }
}

main();
