#!/usr/bin/env node

/**
 * Script de diagnóstico: Identifica citas duplicadas usando conexión PostgreSQL directa
 * Ejecutar con: node diagnose_duplicates_sql.js
 */

require('dotenv').config({ path: './.env' });
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error('❌ Error: DATABASE_URL no encontrado en .env');
    process.exit(1);
}

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false
});

async function main() {
    const client = await pool.connect();
    
    try {
        console.log('========================================');
        console.log('   DIAGNÓSTICO DE CITAS DUPLICADAS');
        console.log('========================================\n');

        // Get today's date in YYYY-MM-DD format
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        
        console.log(`📅 Buscando citas duplicadas para: ${todayStr}\n`);

        // Query to get all appointments for today
        const query = `
            SELECT 
                a.id, 
                a.date, 
                a.time, 
                a.patientId, 
                a.doctorId,
                p.name as patient_name,
                d.name as doctor_name,
                a.status,
                a.created_at
            FROM "Appointment" a
            LEFT JOIN "Patient" p ON a.patientId = p.id
            LEFT JOIN "Doctor" d ON a.doctorId = d.id
            WHERE DATE(a.date) = DATE('${todayStr}')
            AND a.deleted_at IS NULL
            ORDER BY a.doctorId, a.time, a.created_at;
        `;

        const result = await client.query(query);
        const allAppointments = result.rows;

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

        console.log(`⚠️  Se encontraron ${duplicates.length} grupos de citas duplicadas:\n`);
        console.log('─'.repeat(120));

        const toDelete = [];

        duplicates.forEach(([key, appts], idx) => {
            const [doctorId, patientId, time] = key.split('|');
            const docName = appts[0].doctor_name || 'Sin doctor';
            const patientName = appts[0].patient_name || 'Sin paciente';

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

        console.log('\n' + '─'.repeat(120));
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
        console.error(e.stack);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

main();
