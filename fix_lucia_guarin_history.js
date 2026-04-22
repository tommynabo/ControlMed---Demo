#!/usr/bin/env node

/**
 * Script de un solo uso: Reasigna número de historial a Lucia Guarin
 * Su HC-0364 ya pertenece a otro paciente — se le asigna el siguiente disponible.
 * Ejecutar con: node fix_lucia_guarin_history.js
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
    console.log('========================================');
    console.log('   FIX: HISTORIAL LUCIA GUARIN');
    console.log('========================================\n');

    // 1. Buscar a Lucia Guarin
    const { data: matches, error: searchError } = await supabase
        .from('Patient')
        .select('id, name, historyNumber, dni')
        .or('name.ilike.%Lucia%Guarin%,name.ilike.%Guarin%Lucia%');

    if (searchError) {
        console.error('❌ Error buscando paciente:', searchError.message);
        process.exit(1);
    }

    if (!matches || matches.length === 0) {
        console.error('❌ No se encontró ningún paciente con el nombre "Lucia Guarin".');
        console.log('   Prueba buscarla manualmente en la base de datos.');
        process.exit(1);
    }

    if (matches.length > 1) {
        console.log('⚠️  Se encontraron varios pacientes con ese nombre:');
        matches.forEach((p, i) => console.log(`   [${i}] id=${p.id} | historial=${p.historyNumber} | nombre=${p.name}`));
        console.log('\n   El script tomará el registro con historyNumber = HC-0364.');
    }

    const lucia = matches.find(p => p.historyNumber === 'HC-0364') || matches[0];
    console.log(`✅ Paciente encontrada: ${lucia.name}`);
    console.log(`   ID:               ${lucia.id}`);
    console.log(`   Historial actual: ${lucia.historyNumber}`);
    console.log(`   DNI:              ${lucia.dni}\n`);

    if (lucia.historyNumber !== 'HC-0364') {
        console.log('ℹ️  Esta paciente ya no tiene HC-0364. No se requiere ningún cambio.');
        process.exit(0);
    }

    // 2. Calcular el siguiente número disponible
    const { data: allPatients, error: listError } = await supabase
        .from('Patient')
        .select('historyNumber')
        .not('historyNumber', 'is', null);

    if (listError) {
        console.error('❌ Error leyendo historiales:', listError.message);
        process.exit(1);
    }

    let maxNum = 0;
    for (const p of allPatients) {
        const m = p.historyNumber.match(/(?:HC-|HCL-)?0*(\d+)/);
        if (m) {
            const n = parseInt(m[1], 10);
            if (n > maxNum) maxNum = n;
        }
    }

    const nextNum = maxNum + 1;
    const newHistoryNumber = `HC-${String(nextNum).padStart(4, '0')}`;

    console.log(`   Máximo historial encontrado: HC-${String(maxNum).padStart(4, '0')}`);
    console.log(`   Nuevo historial para Lucia:  ${newHistoryNumber}\n`);

    // 3. Confirmar antes de actualizar
    console.log(`🔄 Actualizando: HC-0364 → ${newHistoryNumber}...`);

    const { data: updated, error: updateError } = await supabase
        .from('Patient')
        .update({ historyNumber: newHistoryNumber })
        .eq('id', lucia.id)
        .select('id, name, historyNumber')
        .single();

    if (updateError) {
        console.error('❌ Error actualizando historial:', updateError.message);
        process.exit(1);
    }

    console.log('\n========================================');
    console.log('   ✅ CAMBIO REALIZADO CON ÉXITO');
    console.log('========================================');
    console.log(`   Paciente: ${updated.name}`);
    console.log(`   ID:       ${updated.id}`);
    console.log(`   Historial: HC-0364 → ${updated.historyNumber}`);
    console.log('\n   HC-0364 queda ahora libre para el paciente original.');
}

main().catch(err => {
    console.error('❌ Error inesperado:', err.message);
    process.exit(1);
});
