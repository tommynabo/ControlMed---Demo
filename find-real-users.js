#!/usr/bin/env node

/**
 * Buscar y sincronizar los doctores REALES del sistema
 * Basado en los usuarios activos mostrados en la UI
 */

require('dotenv').config({ path: './server/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    try {
        console.log('🔍 Buscando usuarios REALES del sistema...\n');
        
        // Lista de emails de los usuarios reales
        const realUserEmails = [
            'almudena.deana.81@gmail.com',
            'kevinchrabieh@gmail.com',
            // 'tomasnivraone@gmail.com', // EXCLUIR: Tomas Navarro
            'alvarobabianon@uic.es',
            'pablorooblanco@gmail.com',
            'castaycaroline@gmail.com',
            'blati98172023@hotmail.com',
            'elissaeid@uic.es'
        ];
        
        // Buscar estos usuarios en la BD
        const { data: users, error } = await supabase
            .from('User')
            .select('id, name, email, role')
            .in('email', realUserEmails);
        
        if (error) throw error;
        
        console.log(`✅ Encontrados: ${users.length} usuarios reales\n`);
        
        if (users.length === 0) {
            console.error('❌ No se encontraron usuarios con esos emails');
            process.exit(1);
        }
        
        console.log('Usuarios encontrados:');
        users.forEach((user, i) => {
            console.log(`${i + 1}. ${user.name}`);
            console.log(`   Email: ${user.email}`);
            console.log(`   ID: ${user.id}`);
            console.log(`   Rol: ${user.role}\n`);
        });
        
        // Generar SQL
        console.log('📋 SQL Command:\n');
        const ids = users.map(u => `'${u.id}'`).join(', ');
        const sqlCommand = `-- 1️⃣ ELIMINAR LIQUIDACIONES DE CITAS HUÉRFANAS
DELETE FROM "Liquidation" 
WHERE "appointmentId" IN (
  SELECT id FROM "Appointment" 
  WHERE "doctorId" NOT IN (${ids})
);

-- 2️⃣ ELIMINAR CITAS DE DOCTORES QUE NO SERÁN REALES
DELETE FROM "Appointment" 
WHERE "doctorId" NOT IN (${ids});

-- 3️⃣ LIMPIAR TABLA DOCTOR (BORRAR TODO)
DELETE FROM "Doctor";

-- 4️⃣ INSERTAR SOLO LOS DOCTORES REALES
INSERT INTO "Doctor" (id, name, specialization, "commissionPercentage")
SELECT 
    u.id,
    u.name,
    CASE 
        WHEN u.role = 'ADMIN' THEN 'Administrador'
        ELSE 'Odontólogo'
    END as specialization,
    0 as "commissionPercentage"
FROM "User" u
WHERE u.id IN (${ids});`;
        
        console.log(sqlCommand);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

main();
