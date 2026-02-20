#!/usr/bin/env node

require('dotenv').config({ path: './server/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    try {
        console.log('Verificando tabla Appointment...\n');
        
        const { data: sampleRow, error } = await supabase
            .from('Appointment')
            .select('*')
            .limit(1);
        
        if (error) {
            console.error('Error:', error.message);
            return;
        }
        
        console.log('Tabla "Appointment" EXISTE\n');
        
        console.log('Columnas actuales:');
        if (sampleRow && sampleRow.length > 0) {
            Object.keys(sampleRow[0]).forEach(col => {
                console.log(`  - ${col}`);
            });
        } else {
            console.log('  (Tabla vacia)');
        }
        
        console.log('\nVerificando columnas necesarias:\n');
        
        const neededColumns = ['budget_item_id', 'budget_item_ids', 'budgetId', 'observations'];
        
        if (sampleRow && sampleRow.length > 0) {
            const existingCols = Object.keys(sampleRow[0]);
            neededColumns.forEach(col => {
                const exists = existingCols.includes(col);
                console.log(`${exists ? 'OK' : 'FALTA'} - ${col}`);
            });
        }
        
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

main();
