#!/usr/bin/env node

/**
 * Script de eliminación: ELIMINA las citas duplicadas identificadas
 * Ejecutar con: node remove_duplicates_supabase.js
 * 
 * IMPORTANTE: Este script es IRREVERSIBLE. Elimina registros de la BD.
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
    console.log('⚠️  SERVICE_ROLE_KEY no disponible, usando ANON_KEY\n');
    SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
}

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Error: SUPABASE_URL o credenciales no encontradas');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
    try {
        console.log('========================================');
        console.log('   ELIMINACIÓN DE CITAS DUPLICADAS');
        console.log('========================================\n');

        // Read IDs to delete from file
        if (!fs.existsSync('duplicates_to_delete.json')) {
            console.error('❌ Error: duplicates_to_delete.json no encontrado');
            console.log('Primero ejecuta: node diagnose_supabase_final.js\n');
            process.exit(1);
        }

        const toDelete = JSON.parse(fs.readFileSync('duplicates_to_delete.json', 'utf-8'));

        console.log(`📋 Registros a eliminar: ${toDelete.length}\n`);
        console.log('─'.repeat(100));

        if (toDelete.length === 0) {
            console.log('\n✅ No hay registros para eliminar\n');
            return;
        }

        // Show what will be deleted
        console.log('\n⚠️  CITAS QUE SERÁN ELIMINADAS:\n');
        toDelete.forEach((id, i) => {
            console.log(`   ${i + 1}. ${id}`);
        });

        // Confirm before deletion
        console.log('\n' + '─'.repeat(100));
        console.log('\n⚠️  ATENCIÓN: Esta acción es IRREVERSIBLE\n');
        
        // For automation, we'll proceed directly
        // In a real scenario, you might want user confirmation here
        const proceed = true; // Set to false to abort

        if (!proceed) {
            console.log('❌ Operación cancelada por el usuario\n');
            process.exit(0);
        }

        console.log('🔴 Iniciando ELIMINACIÓN...\n');

        // Delete appointments in batches
        const BATCH_SIZE = 100;
        let deleted = 0;
        let errors = 0;

        for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
            const batch = toDelete.slice(i, i + BATCH_SIZE);
            
            const { error, count } = await supabase
                .from('Appointment')
                .delete()
                .in('id', batch);

            if (error) {
                console.error(`❌ Error eliminando batch ${Math.floor(i / BATCH_SIZE) + 1}:`, error.message);
                errors++;
            } else {
                deleted += batch.length;
                console.log(`✅ Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} registros eliminados`);
            }
        }

        console.log('\n' + '─'.repeat(100));
        console.log(`\n📊 RESULTADO:\n`);
        console.log(`   • Total a eliminar: ${toDelete.length}`);
        console.log(`   • Eliminados: ${deleted}`);
        console.log(`   • Errores: ${errors}`);

        if (errors === 0 && deleted === toDelete.length) {
            console.log('\n✅ ELIMINACIÓN COMPLETADA EXITOSAMENTE\n');
            
            // Clean up
            fs.unlinkSync('duplicates_to_delete.json');
            console.log('🗑️  duplicates_to_delete.json eliminado\n');
            
            console.log('⏭️  PRÓXIMO PASO: Recargar la aplicación en el navegador para ver los cambios\n');
        } else {
            console.log('\n⚠️  ELIMINACIÓN PARCIAL O CON ERRORES\n');
            console.log('Por favor verifica los resultados manualmente\n');
        }

    } catch (e) {
        console.error('❌ Error:', e.message);
        process.exit(1);
    }
}

main();
