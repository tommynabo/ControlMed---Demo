#!/usr/bin/env node

/**
 * Script para importar usuarios a Supabase Auth
 * 
 * Este script importa los 14 usuarios de la clínica a:
 * 1. auth.users (via Supabase Admin API)
 * 2. system_users (tabla de datos extendidos)
 * 
 * REQUISITOS:
 * - npm install @supabase/supabase-js dotenv
 * - Tener variables de entorno configuradas:
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY (para crear usuarios)
 * 
 * INSTRUCCIONES:
 * 1. Copiar este archivo a la carpeta raíz del proyecto
 * 2. Crear archivo .env.local con las credenciales
 * 3. Ejecutar: node supabase_import_users.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Faltan variables de entorno');
  console.error('   VITE_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✓' : '✗');
  console.log('\n📋 Instrucciones:');
  console.log('1. Ir a Supabase Dashboard → Settings → API');
  console.log('2. Copiar "Service Role" key');
  console.log('3. Crear archivo .env.local con:');
  console.log('   VITE_SUPABASE_URL=https://your-project.supabase.co');
  console.log('   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key');
  process.exit(1);
}

// Crear cliente con Service Role Key (permisos de admin)
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const usuarios = [
  // ADMINISTRADORES
  { email: 'kevinchrabieh@gmail.com', full_name: 'Dr. Chrabieh', role: 'ADMIN', password_temp: 'Temporal123!' },
  { email: 'almudena.deana.81@gmail.com', full_name: 'Almudena', role: 'ADMIN', password_temp: 'Temporal123!' },
  { email: 'tomasnivraone@gmail.com', full_name: 'Tomas', role: 'ADMIN', password_temp: 'Temporal123!' },

  // DOCTORES
  { email: 'pablorooblanco@gmail.com', full_name: 'Dr. ROO', role: 'DOCTOR', password_temp: 'Temporal123!' },
  { email: 'blati98172023@hotmail.com', full_name: 'Dra. Concejero', role: 'DOCTOR', password_temp: 'Temporal123!' },
  { email: 'castaycaroline@gmail.com', full_name: 'Dra. Castay', role: 'DOCTOR', password_temp: 'Temporal123!' },
  { email: 'alvarobabianon@uic.es', full_name: 'Alvaro Babiano', role: 'DOCTOR', password_temp: 'Temporal123!' },
  { email: 'elissaeid@uic.es', full_name: 'Elissa', role: 'DOCTOR', password_temp: 'Temporal123!' },

  // RECEPCIONISTAS
  { email: 'admin@chcclinicadental.com', full_name: 'CHC Clinica Dental', role: 'RECEPTIONIST', password_temp: 'Temporal123!' },
  { email: 'letmanmon@gmail.com', full_name: 'Leticia Rodriguez Silvera', role: 'RECEPTIONIST', password_temp: 'Temporal123!' },
  { email: 'alisonGUADAMUDALAY@hotmail.com', full_name: 'Alison Betsy', role: 'RECEPTIONIST', password_temp: 'Temporal123!' },
  { email: 'CLAUDIAVALENTINA30@GMAIL.COM', full_name: 'CLAUDIA', role: 'RECEPTIONIST', password_temp: 'Temporal123!' },
  { email: 'info@echalemarketing.es', full_name: 'Alejandro', role: 'RECEPTIONIST', password_temp: 'Temporal123!' },
  { email: 'Velasconerea98@gmail.com', full_name: 'Nerea', role: 'RECEPTIONIST', password_temp: 'Temporal123!' },
];

async function importUsers() {
  console.log('🚀 Iniciando importación de usuarios...\n');

  let created = 0;
  let failed = 0;
  const results = [];

  for (const usuario of usuarios) {
    try {
      console.log(`⏳ Creando usuario: ${usuario.email}...`);

      // Crear usuario en auth.users
      const { data, error } = await supabase.auth.admin.createUser({
        email: usuario.email,
        password: usuario.password_temp,
        email_confirm: true,
        user_metadata: {
          full_name: usuario.full_name,
          role: usuario.role
        }
      });

      if (error) {
        // Si el error es que el usuario ya existe, continuar
        if (error.message?.includes('already exists')) {
          console.log(`   ⚠️  Usuario ya existe (ignorado)`);
          
          // Obtener el usuario existente para su ID
          const { data: existingUser } = await supabase.auth.admin.listUsers();
          const user = existingUser?.users?.find((u: any) => u.email === usuario.email);
          
          if (user) {
            await createSystemUserIfNotExists(user.id, usuario);
          }
          failed++;
          results.push({ ...usuario, status: 'already_exists', id: user?.id });
        } else {
          console.log(`   ❌ Error: ${error.message}`);
          failed++;
          results.push({ ...usuario, status: 'error', message: error.message });
        }
      } else {
        console.log(`   ✅ Usuario creado: ${data.user?.id}`);
        
        // Crear entrada en system_users
        await createSystemUserIfNotExists(data.user!.id, usuario);
        
        created++;
        results.push({ ...usuario, status: 'created', id: data.user?.id });
      }
    } catch (err: any) {
      console.log(`   ❌ Error inesperado: ${err.message}`);
      failed++;
      results.push({ ...usuario, status: 'exception', message: err.message });
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMEN DE IMPORTACIÓN');
  console.log('='.repeat(60));
  console.log(`✅ Creados: ${created}`);
  console.log(`⚠️  Errores/Existentes: ${failed}`);
  console.log(`📝 Total procesados: ${usuarios.length}`);

  console.log('\n📋 DETALLES:');
  results.forEach(result => {
    const status = result.status === 'created' ? '✅' : result.status === 'already_exists' ? '⚠️' : '❌';
    console.log(`${status} ${result.email} (${result.full_name}) - ${result.status}`);
  });

  console.log('\n💡 PRÓXIMOS PASOS:');
  console.log('1. Los usuarios temporales tienen contraseña: Temporal123!');
  console.log('2. Pedir a cada usuario que cambie su contraseña al primer login');
  console.log('3. Verificar que aparezcan en: Supabase → Authentication → Users');
  console.log('4. Verificar que aparezcan en Settings → Usuarios');
}

async function createSystemUserIfNotExists(userId: string, usuario: any) {
  const { data: existing } = await supabase
    .from('system_users')
    .select('*')
    .eq('id', userId)
    .single();

  if (!existing) {
    const { error } = await supabase
      .from('system_users')
      .insert([{
        id: userId,
        email: usuario.email,
        full_name: usuario.full_name,
        role: usuario.role,
        is_active: true
      }]);

    if (error) {
      console.log(`   ⚠️  Advertencia: No se pudo crear registro en system_users: ${error.message}`);
    } else {
      console.log(`   ✓ Registro en system_users creado`);
    }
  } else {
    console.log(`   ℹ️  Ya existe en system_users`);
  }
}

// Ejecutar
importUsers().catch(err => {
  console.error('❌ Error fatal:', err);
  process.exit(1);
});
