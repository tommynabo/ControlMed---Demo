#!/usr/bin/env node

/**
 * Sincronización automática de Doctores
 * Ejecutar con: node sync-doctors.js
 */

const baseURL = process.env.API_URL || 'http://localhost:3001';

async function syncDoctors() {
    try {
        console.log('🔍 Paso 1: Verificando estado actual...\n');
        
        // Get debug info
        const debugRes = await fetch(`${baseURL}/api/debug/doctors`);
        const debugData = await debugRes.json();
        
        console.log('📊 Estado Actual:');
        console.log(`   Doctores en tabla Doctor: ${debugData.doctor_table.count}`);
        console.log(`   Usuarios con role DOCTOR en User: ${debugData.user_table_doctors.count}`);
        console.log(`   Necesita sincronización: ${debugData.sync_status.needs_sync ? '✅ SÍ' : '❌ NO'}\n`);
        
        if (debugData.user_table_doctors.count === 0) {
            console.log('⚠️  No hay usuarios con role DOCTOR en la tabla User.');
            console.log('   Por favor, crea primero usuarios doctores en Settings > Users\n');
            return;
        }
        
        if (!debugData.sync_status.needs_sync) {
            console.log('✅ Los doctores ya están sincronizados. ¡Nada que hacer!\n');
            return;
        }
        
        console.log('🔄 Paso 2: Sincronizando doctores...\n');
        
        // Sync doctors
        const syncRes = await fetch(`${baseURL}/api/sync/doctors`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const syncData = await syncRes.json();
        
        if (syncRes.ok) {
            console.log(`✅ ${syncData.message}`);
            console.log(`   Doctores sincronizados: ${syncData.synced}\n`);
        } else {
            console.error(`❌ Error: ${syncData.error}\n`);
            return;
        }
        
        console.log('✅ Paso 3: Verificando resultado...\n');
        
        // Verify again
        const verifyRes = await fetch(`${baseURL}/api/debug/doctors`);
        const verifyData = await verifyRes.json();
        
        console.log('📊 Estado Después de Sincronización:');
        console.log(`   Doctores en tabla Doctor: ${verifyData.doctor_table.count}`);
        console.log(`   Usuarios con role DOCTOR: ${verifyData.user_table_doctors.count}\n`);
        
        console.log('🎉 ¡Sincronización completada exitosamente!');
        console.log('   Los doctores deberían aparecer ahora en la Agenda.\n');
        
    } catch (error) {
        console.error('❌ Error durante la sincronización:');
        console.error(`   ${error.message}\n`);
        console.log('💡 Asegúrate de que:');
        console.log(`   1. El servidor está corriendo en ${baseURL}`);
        console.log('   2. La BD de Supabase está conectada\n');
    }
}

console.log('========================================');
console.log('   SINCRONIZACIÓN DE DOCTORES');
console.log('========================================\n');

syncDoctors();
