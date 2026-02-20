#!/usr/bin/env node

/**
 * Listar TODOS los usuarios activos en el sistema
 */

require('dotenv').config({ path: './server/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    try {
        console.log('📋 TODOS los usuarios en el sistema:\n');
        
        // Obtener todos los usuarios
        const { data: users, error } = await supabase
            .from('User')
            .select('id, name, email, role')
            .order('name', { ascending: true });
        
        if (error) throw error;
        
        console.log(`Total de usuarios: ${users.length}\n`);
        
        // Mostrar formato tabla
        users.forEach((user, i) => {
            console.log(`${i + 1}. ${user.name}`);
            console.log(`   Email: ${user.email}`);
            console.log(`   ID: ${user.id}`);
            console.log(`   Rol: ${user.role}\n`);
        });
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

main();
