#!/usr/bin/env node
/**
 * cleanup_test_data_until_apr16.js
 * Borra TODOS los datos de prueba hasta el 16 de abril de 2026 (inclusive)
 * de Supabase y de Quipu.
 *
 * Uso: node cleanup_test_data_until_apr16.js
 */

require('dotenv').config({ path: require('path').join(__dirname, 'server/.env') });

const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const qs    = require('qs');

const CUTOFF = '2026-04-16'; // inclusive

// ─── Supabase ─────────────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// ─── Quipu auth ───────────────────────────────────────────────────────────────
const QUIPU_AUTH_URL = 'https://getquipu.com/oauth/token';
const QUIPU_API_URL  = 'https://getquipu.com';
const APP_ID         = process.env.QUIPU_APP_ID;
const APP_SECRET     = process.env.QUIPU_APP_SECRET;

const quipuClient = axios.create({
  baseURL: QUIPU_API_URL,
  headers: {
    'Accept':       'application/vnd.quipu.v1+json',
    'Content-Type': 'application/vnd.quipu.v1+json',
  },
  timeout: 20000,
});

async function getQuipuToken() {
  const credentials = Buffer.from(`${APP_ID}:${APP_SECRET}`).toString('base64');
  const res = await axios.post(
    QUIPU_AUTH_URL,
    qs.stringify({ grant_type: 'client_credentials', scope: 'ecommerce' }),
    {
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type':  'application/x-www-form-urlencoded;charset=UTF-8',
      },
    }
  );
  return res.data.access_token;
}

async function quipuRequest(method, path, token, data = null) {
  const config = {
    method,
    url: path,
    headers: { Authorization: `Bearer ${token}` },
  };
  if (data) config.data = data;
  const res = await quipuClient(config);
  return res.data;
}

// ─── Helper ───────────────────────────────────────────────────────────────────
function log(msg) { console.log(msg); }

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  log('');
  log('╔══════════════════════════════════════════════════════════════╗');
  log('║  LIMPIEZA DE DATOS DE PRUEBA ≤ 16 ABRIL 2026               ║');
  log('╚══════════════════════════════════════════════════════════════╝');
  log('');

  // ══════════════════════════════════════════════════════════════════
  //  PASO 1 — DRY-RUN: contar registros afectados
  // ══════════════════════════════════════════════════════════════════
  log('━━━  DRY-RUN: contando registros afectados  ━━━');

  const dryRun = async (table, column) => {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .lte(column, CUTOFF + 'T23:59:59');
    if (error) { log(`  ⚠️  ${table}: ${error.message}`); return 0; }
    log(`  ${table.padEnd(20)} → ${count} registros`);
    return count;
  };

  // InvoiceItems no tiene fecha propia — los contamos por sus facturas
  const { count: invoiceCount } = await supabase
    .from('Invoice')
    .select('*', { count: 'exact', head: true })
    .lte('date', CUTOFF + 'T23:59:59');
  log(`  ${'Invoice'.padEnd(20)} → ${invoiceCount ?? 0} registros`);

  const { data: invoiceIds } = await supabase
    .from('Invoice')
    .select('id')
    .lte('date', CUTOFF + 'T23:59:59');
  const ids = (invoiceIds || []).map(r => r.id);
  if (ids.length > 0) {
    const { count: itemCount } = await supabase
      .from('InvoiceItem')
      .select('*', { count: 'exact', head: true })
      .in('invoiceId', ids);
    log(`  ${'InvoiceItem'.padEnd(20)} → ${itemCount ?? 0} registros`);
  }

  await dryRun('Liquidation',     'createdAt');
  await dryRun('Payment',         'createdAt');
  await dryRun('Appointment',     'date');
  await dryRun('ClinicalRecord',  'date');
  await dryRun('Budget',          'createdAt');
  await dryRun('PatientTreatment','createdAt');
  await dryRun('Patient',         'createdAt');

  log('');
  log('━━━  Comenzando borrado en Supabase  ━━━');

  // ══════════════════════════════════════════════════════════════════
  //  PASO 2 — BORRAR SUPABASE (en orden de dependencias)
  // ══════════════════════════════════════════════════════════════════

  async function deleteRows(table, column, value) {
    const { error, count } = await supabase
      .from(table)
      .delete({ count: 'exact' })
      .lte(column, value);
    if (error) {
      log(`  ❌  ${table}: ${error.message}`);
      return 0;
    }
    log(`  ✅  ${table.padEnd(20)} — ${count ?? '?'} filas eliminadas`);
    return count ?? 0;
  }

  // 1. Liquidations
  await deleteRows('Liquidation', 'createdAt', CUTOFF + 'T23:59:59');

  // 2. Payments
  await deleteRows('Payment', 'createdAt', CUTOFF + 'T23:59:59');

  // 3. InvoiceItems — fetch ALL invoice IDs with pagination (Supabase limit=1000/page)
  const allInvoiceIds = [];
  {
    let from = 0;
    const PAGE = 1000;
    while (true) {
      const { data, error } = await supabase
        .from('Invoice')
        .select('id')
        .lte('date', CUTOFF + 'T23:59:59')
        .range(from, from + PAGE - 1);
      if (error) { log(`  ❌  Invoice ID fetch error: ${error.message}`); break; }
      if (!data || data.length === 0) break;
      data.forEach(r => allInvoiceIds.push(r.id));
      if (data.length < PAGE) break;
      from += PAGE;
    }
  }
  log(`  ℹ️   Facturas a limpiar: ${allInvoiceIds.length}`);

  if (allInvoiceIds.length > 0) {
    // First clear any payments still referencing those invoices (AFTER cutoff edge case)
    let extraPayments = 0;
    for (let i = 0; i < allInvoiceIds.length; i += 50) {
      const chunk = allInvoiceIds.slice(i, i + 50);
      const { count } = await supabase.from('Payment').delete({ count: 'exact' }).in('invoiceId', chunk);
      extraPayments += count ?? 0;
    }
    if (extraPayments > 0) log(`  ✅  Payment (extra FK)      — ${extraPayments} filas eliminadas`);

    // Delete InvoiceItems in batches of 50
    let totalItemsDeleted = 0;
    for (let i = 0; i < allInvoiceIds.length; i += 50) {
      const chunk = allInvoiceIds.slice(i, i + 50);
      const { error: iiErr, count: iiCount } = await supabase
        .from('InvoiceItem')
        .delete({ count: 'exact' })
        .in('invoiceId', chunk);
      if (iiErr) { log(`  ❌  InvoiceItem batch ${i}: ${iiErr.message}`); }
      else { totalItemsDeleted += (iiCount ?? 0); }
    }
    log(`  ✅  ${'InvoiceItem'.padEnd(20)} — ${totalItemsDeleted} filas eliminadas`);
  } else {
    log(`  ✅  ${'InvoiceItem'.padEnd(20)} — 0 filas (sin facturas que borrar)`);
  }

  // 4. Invoices
  await deleteRows('Invoice', 'date', CUTOFF + 'T23:59:59');

  // 5. Appointments (idempotente — ya borradas)
  await deleteRows('Appointment', 'date', CUTOFF);

  // 6. ClinicalRecords (idempotente)
  await deleteRows('ClinicalRecord', 'date', CUTOFF + 'T23:59:59');

  // 7. Budgets (BudgetLineItems en cascada)
  await deleteRows('Budget', 'createdAt', CUTOFF + 'T23:59:59');

  // 8. PatientTreatments
  await deleteRows('PatientTreatment', 'createdAt', CUTOFF + 'T23:59:59');

  // 9. Patients — solo los sin actividad posterior (chequeo de TODOS los FK)
  const { data: patientsToCheck } = await supabase
    .from('Patient')
    .select('id')
    .lte('createdAt', CUTOFF + 'T23:59:59');

  const allOldPatientIds = (patientsToCheck || []).map(r => r.id);
  const blockedIds = new Set();

  for (let i = 0; i < allOldPatientIds.length; i += 50) {
    const chunk = allOldPatientIds.slice(i, i + 50);

    // Citas posteriores
    const { data: a } = await supabase.from('Appointment').select('patientId').in('patientId', chunk).gt('date', CUTOFF);
    (a || []).forEach(r => blockedIds.add(r.patientId));

    // Facturas posteriores
    const { data: inv } = await supabase.from('Invoice').select('patientId').in('patientId', chunk).gt('date', CUTOFF + 'T23:59:59');
    (inv || []).forEach(r => blockedIds.add(r.patientId));

    // WhatsAppLogs
    const { data: w } = await supabase.from('WhatsAppLog').select('patientId').in('patientId', chunk);
    (w || []).forEach(r => blockedIds.add(r.patientId));

    // Prescriptions
    const { data: rx } = await supabase.from('Prescription').select('patientId').in('patientId', chunk);
    (rx || []).forEach(r => blockedIds.add(r.patientId));

    // Consents
    const { data: c } = await supabase.from('Consent').select('patientId').in('patientId', chunk);
    (c || []).forEach(r => blockedIds.add(r.patientId));

    // Budgets posteriores
    const { data: b } = await supabase.from('Budget').select('patientId').in('patientId', chunk).gt('createdAt', CUTOFF + 'T23:59:59');
    (b || []).forEach(r => blockedIds.add(r.patientId));

    // Payments posteriores
    const { data: pay } = await supabase.from('Payment').select('patientId').in('patientId', chunk).gt('createdAt', CUTOFF + 'T23:59:59');
    (pay || []).forEach(r => blockedIds.add(r.patientId));
  }

  const safeToDelete = allOldPatientIds.filter(id => !blockedIds.has(id));
  const blocked = allOldPatientIds.length - safeToDelete.length;

  if (blocked > 0) {
    log(`  ℹ️   ${blocked} pacientes tienen actividad posterior o están referenciados → NO se borran`);
  }

  if (safeToDelete.length > 0) {
    let totalPatientsDeleted = 0;
    for (let i = 0; i < safeToDelete.length; i += 50) {
      const chunk = safeToDelete.slice(i, i + 50);
      const { error: pErr, count: pCount } = await supabase
        .from('Patient')
        .delete({ count: 'exact' })
        .in('id', chunk);
      if (pErr) log(`  ❌  Patient batch ${i}: ${pErr.message}`);
      else totalPatientsDeleted += (pCount ?? 0);
    }
    log(`  ✅  ${'Patient'.padEnd(20)} — ${totalPatientsDeleted} filas eliminadas`);
  } else {
    log(`  ✅  ${'Patient'.padEnd(20)} — 0 filas seguras para eliminar`);
  }

  log('');
  log('━━━  Supabase completado  ━━━');

  // ══════════════════════════════════════════════════════════════════
  //  PASO 3 — QUIPU: listar y borrar facturas ≤ 16 abril
  // ══════════════════════════════════════════════════════════════════
  log('');
  log('━━━  Conectando a Quipu  ━━━');
  let token;
  try {
    token = await getQuipuToken();
    log('  ✅  Token obtenido');
  } catch (err) {
    log(`  ❌  No se pudo obtener token de Quipu: ${err.message}`);
    log('  ⚠️   Omitiendo limpieza de Quipu. Hazla manualmente desde app.getquipu.com');
    return finish();
  }

  // Quipu pagina con page[number] y page[size]
  // Filtramos kind=income y date_lteq=2026-04-16
  log('  🔍  Buscando facturas en Quipu hasta 2026-04-16...');
  const toDelete = [];
  let page = 1;
  const PAGE_SIZE = 100;

  while (true) {
    let res;
    try {
      res = await quipuRequest(
        'GET',
        `/invoices?filter[kind]=income&filter[issue_date_lteq]=${CUTOFF}&page[number]=${page}&page[size]=${PAGE_SIZE}`,
        token
      );
    } catch (err) {
      log(`  ⚠️   Error al listar facturas Quipu (pág ${page}): ${err.response?.data ? JSON.stringify(err.response.data) : err.message}`);
      break;
    }

    const invoices = res?.data || [];
    if (invoices.length === 0) break;

    for (const inv of invoices) {
      const date   = inv.attributes?.issue_date || '';
      const number = inv.attributes?.number     || inv.id;
      toDelete.push({ id: inv.id, number, date });
    }

    log(`  📄  Página ${page}: ${invoices.length} facturas encontradas (total acumulado: ${toDelete.length})`);

    // Si vino menos de PAGE_SIZE, no hay más páginas
    if (invoices.length < PAGE_SIZE) break;
    page++;
  }

  log(`  📊  Total facturas Quipu a eliminar: ${toDelete.length}`);

  let deleted = 0;
  let failed  = 0;
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  for (const inv of toDelete) {
    try {
      await quipuRequest('DELETE', `/invoices/${inv.id}`, token);
      log(`  🗑️   Quipu #${inv.number} (${inv.date}) eliminada`);
      deleted++;
    } catch (err) {
      const status = err.response?.status;
      const body   = err.response?.data ? JSON.stringify(err.response.data) : err.message;

      if (status === 429 || (typeof body === 'string' && body.includes('rate limit'))) {
        log(`  ⏳  Rate limit alcanzado — esperando 7 segundos...`);
        await sleep(7000);
        // retry once
        try {
          await quipuRequest('DELETE', `/invoices/${inv.id}`, token);
          log(`  🗑️   Quipu #${inv.number} (${inv.date}) eliminada (reintento)`);
          deleted++;
          await sleep(2000);
          continue;
        } catch (retryErr) {
          log(`  ❌  Quipu #${inv.number} (${inv.date}) — fallo en reintento: ${retryErr.response?.data ? JSON.stringify(retryErr.response.data) : retryErr.message}`);
        }
      } else if (status === 403) {
        log(`  ⚠️   Quipu #${inv.number} (${inv.date}) — 403: factura bloqueada/contabilizada. Bórrala manualmente en app.getquipu.com`);
      } else {
        log(`  ❌  Quipu #${inv.number} (${inv.date}) — ${status}: ${body}`);
      }
      failed++;
    }
    // Respetar rate limit de Quipu (~1 req/seg recomendado)
    await sleep(2000);
  }

  log('');
  log(`  Quipu: ${deleted} eliminadas, ${failed} fallidas`);

  finish();
}

function finish() {
  log('');
  log('╔══════════════════════════════════════════════════════════════╗');
  log('║  ✅  LIMPIEZA COMPLETADA                                    ║');
  log('╚══════════════════════════════════════════════════════════════╝');
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
