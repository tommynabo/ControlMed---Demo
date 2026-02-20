#!/usr/bin/env node

/**
 * Buscar usuarios REALES en auth.users de Supabase
 */

require('dotenv').config({ path: './server/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
    console.error('❌ Se requiere SUPABASE_SERVICE_ROLE_KEY para acceder a auth.users');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    try {
        console.log('🔍 Buscando usuarios en auth.users...\n');
        
        // Obtener todos los usuarios de auth
        const { data: { users }, error } = await supabase.auth.admin.listUsers({
            perPage: 1000
        });
        
        if (error) throw error;
        
        console.log(`Total de usuarios en auth: ${users.length}\n`);
        
        // Mostrar usuarios
        users.forEach((user, i) => {
            const email = user.email || 'N/A';
            const name = user.user_metadata?.name || user.user_metadata?.full_name || 'Sin nombre';
            console.log(`${i + 1}. ${name}`);
            console.log(`   Email: ${email}`);
            console.log(`   ID: ${user.id}`);
            console.log(`   Creado: ${new Date(user.created_at).toLocaleDateString('es-ES')}\n`);
        });
        
        // Búsqueda específica de los usuarios reales
        console.log('\n🔎 Buscando usuarios específicos:\n');
        
        const searchNames = [
            'Almudena',
            'Kevin Chrabieh',
            'Alvaro Babiano',
            'Pablo Roo',
            'Caroline',
            'Concejero',
            'Elissa'
        ];
        
        const foundUsers = users.filter(u => {
            const name = u.user_metadata?.name || u.user_metadata?.full_name || '';
            const email = u.email || '';
            return searchNames.some(n => name.toLowerCase().includes(n.toLowerCase()) || email.toLowerCase().includes(n.toLowerCase()));
        });
        
        console.log(`✅ Encontrados: ${foundUsers.length} usuarios reales\n`);
        
        foundUsers.forEach((user, i) => {
            const email = user.email || 'N/A';
            const name = user.user_metadata?.name || user.user_metadata?.full_name || 'Sin nombre';
            console.log(`${i + 1}. ${name}`);
            console.log(`   Email: ${email}`);
            console.log(`   ID Auth: ${user.id}\n`);
        });
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

main();
