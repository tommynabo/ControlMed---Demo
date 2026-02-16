#!/usr/bin/env node

/**
 * Sincronizar SOLO doctores reales
 */

require('dotenv').config({ path: './server/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    try {
        const realUserIds = ['user-1', 'user-2', 'user-3', 'user-4', 'user-5', 'user-admin'];
        
        console.log('🗑️  Paso 1: Eliminar Liquidations de citas huérfanas...\n');
        
        // Get IDs of appointments that will be deleted
        const { data: appointmentsToDelete } = await supabase
            .from('Appointment')
            .select('id')
            .not('doctorId', 'in', `(${realUserIds.map(id => `"${id}"`).join(',')})`);
        
        if (appointmentsToDelete?.length > 0) {
            const appointmentIds = appointmentsToDelete.map(a => a.id);
            await supabase
                .from('Liquidation')
                .delete()
                .in('appointmentId', appointmentIds);
            console.log(`✅ Eliminadas ${appointmentsToDelete.length} liquidaciones\n`);
        }
        
        console.log('🗑️  Paso 2: Eliminar citas de doctores que no serán reales...\n');
        
        const { error: appointmentError } = await supabase
            .from('Appointment')
            .delete()
            .not('doctorId', 'in', `(${realUserIds.map(id => `"${id}"`).join(',')})`);
        
        if (appointmentError) console.error('Error:', appointmentError.message);
        else console.log('✅ Citas huérfanas eliminadas\n');
        
        console.log('🗑️  Paso 3: Limpiar tabla Doctor...\n');
        
        const { error: deleteError } = await supabase
            .from('Doctor')
            .delete()
            .neq('id', ''); // Delete all rows
        
        if (deleteError) throw deleteError;
        console.log('✅ Tabla limpiada\n');
        
        console.log('➕ Paso 4: Insertar SOLO doctores reales...\n');
        
        const realDoctors = [
            { id: 'user-1', name: 'Dr. House', role: 'DOCTOR' },
            { id: 'user-2', name: 'Dra. Grey', role: 'DOCTOR' },
            { id: 'user-3', name: 'Dr. Strange', role: 'DOCTOR' },
            { id: 'user-4', name: 'Dra. Quinn', role: 'DOCTOR' },
            { id: 'user-5', name: 'Dr. Oz', role: 'DOCTOR' },
            { id: 'user-admin', name: 'Director Médico', role: 'ADMIN' }
        ];
        
        for (const user of realDoctors) {
            const { error } = await supabase
                .from('Doctor')
                .insert({
                    id: user.id,
                    name: user.name,
                    specialization: user.role === 'ADMIN' ? 'Administrador' : 'Odontólogo',
                    commissionPercentage: 0
                });
            
            if (!error) {
                console.log(`✅ ${user.name}`);
            } else {
                console.error(`❌ Error al insertar ${user.name}: ${error.message}`);
            }
        }
        
        console.log('\n✅ Paso 5: Verificando resultado...\n');
        
        const { data: doctors, error: verifyError } = await supabase
            .from('Doctor')
            .select('id, name');
        
        if (verifyError) throw verifyError;
        
        console.log(`📊 Total de doctores en el sistema: ${doctors.length}\n`);
        doctors.forEach((doc, i) => {
            console.log(`   ${i + 1}. ${doc.name}`);
        });
        
        console.log('\n🎉 ¡Sincronización de doctores reales completada!');
        console.log('   Ahora recarga el navegador para ver los cambios.\n');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

main();
