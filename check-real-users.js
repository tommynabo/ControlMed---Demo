#!/usr/bin/env node

/**
 * Script para identificar qué usuarios reales tiene el sistema
 */

require('dotenv').config({ path: './server/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    try {
        console.log('🔍 Usuarios reales en el sistema:\n');
        
        // Get all users with role DOCTOR or ADMIN, excluding Tomas Navarro
        const { data: users, error } = await supabase
            .from('User')
            .select('id, name, email, role')
            .in('role', ['DOCTOR', 'ADMIN'])
            .neq('name', 'Tomas Navarro');
        
        if (error) throw error;
        
        console.log(`Encontrados: ${users.length} usuarios\n`);
        
        users.forEach((user, i) => {
            console.log(`${i + 1}. ${user.name}`);
            console.log(`   ID: ${user.id}`);
            console.log(`   Email: ${user.email}`);
            console.log(`   Rol: ${user.role}\n`);
        });
        
        console.log('\n📋 SQL para sincronizar SOLO estos usuarios:\n');
        
        const ids = users.map(u => `'${u.id}'`).join(', ');
        const sqlCommand = `-- Limpiar tabla Doctor y reinsertar solo usuarios reales
DELETE FROM "Doctor";

INSERT INTO "Doctor" (id, name, specialization, "commissionPercentage")
SELECT 
    u.id,
    u.name,
    CASE 
        WHEN u.role = 'ADMIN' THEN 'Administrador'
        ELSE 'Odontólogo'
    END as specialization,
    0.0 as "commissionPercentage"
FROM "User" u
WHERE u.id IN (${ids});`;
        
        console.log(sqlCommand);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

main();
