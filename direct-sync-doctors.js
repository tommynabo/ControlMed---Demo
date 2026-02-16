#!/usr/bin/env node

/**
 * Script de sincronización directa a Supabase
 * Ejecutar con: node direct-sync-doctors.js
 */

require('dotenv').config({ path: './server/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Error: SUPABASE_URL y SUPABASE_KEY no encontrados en .env');
    console.error('   Asegúrate de que existe server/.env con las credenciales correctas');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    try {
        console.log('========================================');
        console.log('   SINCRONIZACIÓN DIRECTA DE DOCTORES');
        console.log('========================================\n');
        
        console.log('🔍 Paso 1: Verificando estado actual...\n');
        
        // Get current doctors in Doctor table
        const { data: doctors, error: doctorsError } = await supabase
            .from('Doctor')
            .select('id, name');
        
        if (doctorsError) throw doctorsError;
        
        console.log(`   Doctores actuales en tabla Doctor: ${doctors?.length || 0}`);
        
        // Get doctors from User table
        const { data: doctorUsers, error: usersError } = await supabase
            .from('User')
            .select('id, name')
            .eq('role', 'DOCTOR');
        
        if (usersError) throw usersError;
        
        console.log(`   Usuarios con role DOCTOR en tabla User: ${doctorUsers?.length || 0}\n`);
        
        if (!doctorUsers || doctorUsers.length === 0) {
            console.log('⚠️  No hay usuarios con role DOCTOR en la tabla User.');
            console.log('   Por favor, crea primero usuarios doctores en la aplicación.\n');
            process.exit(0);
        }
        
        console.log('🔄 Paso 2: Sincronizando doctores...\n');
        
        // Insert/upsert all doctor users into Doctor table
        let synced = 0;
        for (const user of doctorUsers) {
            const { error } = await supabase
                .from('Doctor')
                .upsert({
                    id: user.id,
                    name: user.name,
                    specialization: 'Odontólogo',
                    commissionPercentage: 0
                }, { onConflict: 'id' });
            
            if (!error) synced++;
            else console.error(`   ⚠️  Error al sincronizar ${user.name}: ${error.message}`);
        }
        
        console.log(`   ✅ Sincronizados: ${synced}/${doctorUsers.length} doctores\n`);
        
        console.log('✅ Paso 3: Verificando resultado...\n');
        
        // Verify
        const { data: doctorsAfter, error: verifyError } = await supabase
            .from('Doctor')
            .select('id, name');
        
        if (verifyError) throw verifyError;
        
        console.log(`   Doctores en tabla Doctor ahora: ${doctorsAfter?.length || 0}`);
        console.log(`   Cambio: +${synced} doctores\n`);
        
        console.log('🎉 ¡Sincronización completada exitosamente!');
        console.log('   Los doctores deberían aparecer ahora en la Agenda.\n');
        
    } catch (error) {
        console.error('❌ Error durante la sincronización:');
        console.error(`   ${error.message}\n`);
        process.exit(1);
    }
}

main();
