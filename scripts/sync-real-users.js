const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) { console.error('Set SUPABASE_SERVICE_ROLE_KEY in .env'); process.exit(1); }
const supabase = createClient(
  process.env.SUPABASE_URL || 'https://gnnacijqglcqonholpwt.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  // 1. Delete old dummy users
  console.log('Deleting old dummy users...');
  const { error: delErr } = await supabase.from('User').delete().in('id', [
    'user-admin', 'user-rep1', 'user-rep2', 'user-1', 'user-2', 'user-3', 'user-4', 'user-5'
  ]);
  if (delErr) console.log('Delete warning:', delErr.message);
  else console.log('✅ Old dummy users deleted');

  // 2. Insert real users from system_users
  // Role mapping: ADMIN→ADMIN, RECEPTIONIST→RECEPTION, ASSISTANT→AUXILIAR (later), DOCTOR→DOCTOR
  const DEFAULT_PASS = 'ControlMed2026';

  const realUsers = [
    // ADMIN
    { id: 'user-tomas', email: 'tomasnivraone@gmail.com', gmail: 'tomasnivraone@gmail.com', name: 'Tomas Navarro', password: DEFAULT_PASS, role: 'ADMIN', doctorId: null },
    { id: 'user-kevin', email: 'kevinchrabieh@gmail.com', gmail: 'kevinchrabieh@gmail.com', name: 'Dr. Kevin Chrabieh', password: DEFAULT_PASS, role: 'ADMIN', doctorId: 'user-1' },

    // RECEPTION
    { id: 'user-chc', email: 'admin@chcclinicadental.com', gmail: 'admin@chcclinicadental.com', name: 'CHC Clinica Dental', password: DEFAULT_PASS, role: 'RECEPTION', doctorId: null },

    // DOCTOR
    { id: 'user-alvaro', email: 'alvarobabianon@uic.es', gmail: 'alvarobabianon@uic.es', name: 'Dr. Alvaro Babiano', password: DEFAULT_PASS, role: 'DOCTOR', doctorId: 'user-2' },
    { id: 'user-pablo', email: 'pablorooblanco@gmail.com', gmail: 'pablorooblanco@gmail.com', name: 'Dr. Pablo Roo Blanco', password: DEFAULT_PASS, role: 'DOCTOR', doctorId: 'user-3' },
    { id: 'user-caroline', email: 'castaycaroline@gmail.com', gmail: 'castaycaroline@gmail.com', name: 'Dra. Caroline Castay', password: DEFAULT_PASS, role: 'DOCTOR', doctorId: 'user-4' },
    { id: 'user-concejero', email: 'blati98172023@hotmail.com', gmail: 'blati98172023@hotmail.com', name: 'Dra. Concejero', password: DEFAULT_PASS, role: 'DOCTOR', doctorId: 'user-5' },
    { id: 'user-elissa', email: 'elissaeid@uic.es', gmail: 'elissaeid@uic.es', name: 'Dra. Elissa Eid', password: DEFAULT_PASS, role: 'DOCTOR', doctorId: null },

    // AUXILIAR (ASSISTANT in system_users) - will be added as RECEPTION temporarily if AUXILIAR enum not ready
    // These will be updated to AUXILIAR after the SQL migration runs
    { id: 'user-alejandro', email: 'info@echalemarketing.es', gmail: 'info@echalemarketing.es', name: 'Alejandro', password: DEFAULT_PASS, role: 'RECEPTION', doctorId: null },
    { id: 'user-alison', email: 'alisonguadamudalay@hotmail.com', gmail: 'alisonGUADAMUDALAY@hotmail.com', name: 'Alison Betsy', password: DEFAULT_PASS, role: 'RECEPTION', doctorId: null },
    { id: 'user-claudia', email: 'claudiavalentina30@gmail.com', gmail: 'CLAUDIAVALENTINA30@GMAIL.COM', name: 'Claudia', password: DEFAULT_PASS, role: 'RECEPTION', doctorId: null },
    { id: 'user-nerea', email: 'velasconerea98@gmail.com', gmail: 'Velasconerea98@gmail.com', name: 'Nerea', password: DEFAULT_PASS, role: 'RECEPTION', doctorId: null },
  ];

  console.log('Inserting real users...');
  const { data, error } = await supabase
    .from('User')
    .upsert(realUsers, { onConflict: 'id' })
    .select('id, email, name, role, gmail, doctorId');

  if (error) {
    console.error('❌ Insert error:', error.message);
  } else {
    console.log('✅ All users created successfully:');
    data.forEach(u => {
      console.log(`  ${u.role.padEnd(10)} | ${u.name.padEnd(22)} | ${u.email.padEnd(35)} | doctor: ${u.doctorId || '—'}`);
    });
  }
}

main().catch(e => console.error('Fatal:', e));
