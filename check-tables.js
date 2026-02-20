#!/usr/bin/env node

/**
 * Listar TODAS las tablas en Supabase
 */

require('dotenv').config({ path: './server/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    try {
        console.log('� Buscando tabla de citas...\n');
        
        // Intentar obtener datos de tabla específica
        const tables = ['appointment', 'Appointment', 'appointments', 'APPOINTMENT'];
        
        for (const table of tables) {
            try {
                const { data: test, error: testError } = await supabase
                    .from(table)
                    .select('id')
                    .limit(1);
                
                if (!testError) {
                    console.log(`✅ Tabla EXISTE: "${table}"\n`);
                    
                    const { data: sampleRow } = await supabase
                        .from(table)
                        .select('*')
                        .limit(1);
                    
                    console.log(`Columnas en "${table}":`);
                    if (sampleRow && sampleRow.length > 0) {
                        Object.keys(sampleRow[0]).forEach(col => {
                            console.log(`  - ${col}`);
                        });
                    } else {
                        console.log('  (Tabla vacía, estructura no disponible)');
                    return;
                }
            } catch (e) {
                // Tab doesn't exist, continue
            }
        }
        
        console.log('❌ No se encontró la table de citas');
        console.log('   Tablas probadas: appointment, Appointment, appointments, APPOINTMENT');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

main();
