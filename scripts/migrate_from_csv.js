/**
 * MIGRACIÓN CSV → SUPABASE
 * Dental CRM — CHC Clínica Dental
 * Estrategia: UPSERT aditivo (NUNCA destruye datos existentes)
 */

'use strict';

const { createClient } = require('@supabase/supabase-js');
const { parse } = require('csv-parse/sync');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gnnacijqglcqonholpwt.supabase.co';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!SERVICE_KEY) { console.error('Set SUPABASE_SERVICE_ROLE_KEY in .env'); process.exit(1); }
const BASE_DIR     = path.join(__dirname, '..', 'BaseDatos');

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// ─── CSV FILE IDs ─────────────────────────────────────────────────────────────
const FILES = {
  contacts:    '61ecc3d7452276abae3b6a984cae43e8_37734_1774369609.csv',
  evolution1:  '03694bbbf68285d2b8bb97e36fc29570_37749_1774408525.csv',
  evolution2:  '685e9acba6163bc7f436dcb324fc30cd_37750_1774408532.csv',
  invoices:    '034ab9376840234e3f4a1a9c224ac16f_37762_1774408546.csv',
  caja:        '2358be1322018d0576a492d3c6b25398_37760_1774408544.csv',
  budgets:     '5ad6a3ce9affc0b9510af346244ce5df_37752_1774408541.csv',
  appointments:'946cdbb8594d3d0cc99eba45859058fa_37757_1774408543.csv',
  products:    '9fec6a5a722daa27e6fc1e4370d9ee47_37753_1774369983.csv',
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function readCsv(filename) {
  const file = path.join(BASE_DIR, filename);
  const raw  = fs.readFileSync(file, 'utf8');
  return parse(raw, {
    delimiter: ';',
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    trim: true,
  });
}

function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }
function warn(msg) { console.warn(`  ⚠️  ${msg}`); }

function clean(v) { return (v || '').trim(); }
function cleanDni(v) { return clean(v).toUpperCase().replace(/\s/g, ''); }
function parseDate(s) {
  if (!s || !clean(s)) return null;
  // Formats: DD/MM/YYYY or YYYY-MM-DD
  const trimmed = clean(s);
  if (trimmed.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
    const [d, m, y] = trimmed.split('/');
    return `${y}-${m}-${d}T00:00:00.000Z`;
  }
  if (trimmed.match(/^\d{4}-\d{2}-\d{2}/)) {
    return new Date(trimmed).toISOString();
  }
  return null;
}

// Upsert in chunks to stay within Supabase limits
async function upsertBatch(table, rows, onConflict, chunkSize = 200) {
  let inserted = 0, updated = 0, errors = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase
      .from(table)
      .upsert(chunk, { onConflict, ignoreDuplicates: false });
    if (error) {
      warn(`Batch ${i}–${i+chunk.length} on "${table}": ${error.message}`);
      errors += chunk.length;
    } else {
      inserted += chunk.length;
    }
  }
  return { inserted, errors };
}

// ─── STEP 1: PATIENTS ─────────────────────────────────────────────────────────
async function migratePatients() {
  log('── STEP 1: Patients ─────────────────────────────────────────────');
  const rows = readCsv(FILES.contacts);
  log(`  CSV rows: ${rows.length}`);

  // Fetch existing patients from Supabase (we need the id+dni+email+name map)
  const { data: existing, error: fetchErr } = await supabase
    .from('Patient')
    .select('id, dni, email, name, historyNumber');
  if (fetchErr) throw new Error('Cannot fetch existing patients: ' + fetchErr.message);
  log(`  Existing patients in Supabase: ${existing.length}`);

  // Build lookup maps — include SIN-DNI-xxx placeholders used by previous imports
  const byDni   = new Map(existing.filter(p => p.dni).map(p => [cleanDni(p.dni), p]));
  const byEmail = new Map(existing.filter(p => p.email && !p.email.includes('@import.local')).map(p => [p.email.toLowerCase(), p]));
  const byName  = new Map(existing.map(p => [p.name.toLowerCase().trim(), p]));

  // We'll build the IDCONTACTO→uuid map for later steps
  const contactMap = new Map(); // IDCONTACTO (string) → Patient.id (uuid)

  const toInsert = [];
  const toUpdate = []; // { id, historyNumber, phone?, allergies?, ... }

  // Pre-scan NUM values to detect duplicates — "first wins" for historyNumber assignment
  const numCount = new Map();
  for (const r of rows) {
    const n = clean(r['NUM']);
    if (n) numCount.set(n, (numCount.get(n) || 0) + 1);
  }
  // Normalize existing historyNumbers to HC-XXXX when building the claimed set,
  // so bare-number patients (e.g. "350") and HC-prefixed ones don't collide
  const claimedNums = new Set(
    existing
      .filter(p => p.historyNumber)
      .map(p => {
        const m = p.historyNumber.match(/(?:HC-|HCL-)?0*(\d+)/);
        return m ? `HC-${String(parseInt(m[1], 10)).padStart(4, '0')}` : p.historyNumber;
      })
  );

  for (const r of rows) {
    const idcontacto = clean(r['IDCONTACTO']);
    const num        = clean(r['NUM']);
    const nombre     = clean(r['NOMBRE']);
    const apellidos  = clean(r['APELLIDOS']);
    const fullName   = [nombre, apellidos].filter(Boolean).join(' ');
    const dni        = cleanDni(r['DNI']);
    const email      = clean(r['EMAIL']).toLowerCase();
    const phone      = clean(r['TELF. MOVIL']) || clean(r['TELF. FIJO']);
    const birthStr   = parseDate(r['F. NACIMIENTO']);
    const allergies  = clean(r['PATOLOGÍA']);
    const notes      = clean(r['NOTAS']);
    const mutua      = clean(r['MUTUA']);

    // Resolve safe historyNumber: normalize to HC-XXXX and assign if not already claimed
    let safeNum = null;
    if (num) {
      const normalized = `HC-${String(parseInt(num, 10)).padStart(4, '0')}`;
      if (!claimedNums.has(normalized)) {
        safeNum = normalized;
        claimedNums.add(normalized);
      }
      // else: num already taken — leave historyNumber as null for this patient
    }

    // Match by DNI first, then Supabase placeholder format, then email, then name
    let matched = null;
    if (dni) matched = byDni.get(dni);
    // Patients without real DNI were stored in Supabase as SIN-DNI-{IDCONTACTO}
    if (!matched && !dni) matched = byDni.get(`SIN-DNI-${idcontacto}`);
    if (!matched && email) matched = byEmail.get(email);
    if (!matched && fullName) matched = byName.get(fullName.toLowerCase());

    if (matched) {
      contactMap.set(idcontacto, matched.id);
      // Build UPDATE patch (only fill empty fields)
      const patch = { id: matched.id };
      let changed = false;
      if (safeNum && !matched.historyNumber) { patch.historyNumber = safeNum; changed = true; }
      if (allergies && !matched.allergies) { patch.allergies = allergies; changed = true; }
      if (notes) { patch.medicalHistory = notes; changed = true; }
      if (changed) toUpdate.push(patch);
    } else {
      // New patient — insert
      const newId = randomUUID();
      contactMap.set(idcontacto, newId);

      // Use same SIN-DNI-xxx format Supabase already uses for placeholder DNIs
      const placeholderDni = dni || `SIN-DNI-${idcontacto}`;
      toInsert.push({
        id:            newId,
        historyNumber: safeNum || null,
        name:          fullName || nombre || 'Sin nombre',
        firstName:     nombre || null,
        lastName1:     apellidos ? apellidos.split(' ')[0] : null,
        lastName2:     apellidos && apellidos.split(' ').length > 1 ? apellidos.split(' ').slice(1).join(' ') : null,
        dni:           placeholderDni,
        birthDate:     birthStr || '1900-01-01T00:00:00.000Z',
        email:         email || `noreply_${idcontacto}@import.local`,
        phone:         phone || null,
        insurance:     mutua || null,
        allergies:     allergies || null,
        medicalHistory: notes || null,
        balance:       0,
        wallet:        0,
        smoker:        false,
      });
    }
  }

  log(`  → ${toInsert.length} new patients to insert, ${toUpdate.length} to update`);

  // Deduplicate toInsert by DNI (intra-CSV duplicates — first wins)
  const seenDnis = new Set();
  const toInsertDeduped = toInsert.filter(p => {
    if (seenDnis.has(p.dni)) { warn(`Skipping duplicate DNI in CSV: ${p.dni}`); return false; }
    seenDnis.add(p.dni); return true;
  });
  log(`  → After dedup: ${toInsertDeduped.length} patients to insert`);

  // INSERT new patients using 'id' as conflict key; ON CONFLICT DO NOTHING for safety
  if (toInsertDeduped.length > 0) {
    const { inserted, errors } = await upsertBatch('Patient', toInsertDeduped, 'id');
    log(`  ✔ Inserted: ${inserted} | Errors: ${errors}`);
  }

  // UPDATE existing patients (patch historyNumber + allergies)
  let updateOk = 0, updateErr = 0;
  for (const patch of toUpdate) {
    const { id, ...fields } = patch;
    const { error } = await supabase.from('Patient').update(fields).eq('id', id);
    if (error) { warn(`Update patient ${id}: ${error.message}`); updateErr++; }
    else updateOk++;
  }
  log(`  ✔ Updated: ${updateOk} | Errors: ${updateErr}`);

  log(`  ✔ IDCONTACTO map populated: ${contactMap.size} entries`);
  return contactMap;
}

// ─── STEP 2: CLINICAL RECORDS ─────────────────────────────────────────────────
async function migrateClinicalRecords(contactMap) {
  log('── STEP 2: ClinicalRecords ──────────────────────────────────────');

  // Fetch existing records to dedup (patientId + date string)
  const { data: existing } = await supabase.from('ClinicalRecord').select('patientId, date');
  const existingSet = new Set(existing.map(r => `${r.patientId}|${r.date}`));

  const records = [];

  // CSV 1: detailed evolution
  const evo1 = readCsv(FILES.evolution1);
  log(`  evolution1 rows: ${evo1.length}`);
  for (const r of evo1) {
    const pid = contactMap.get(clean(r['IDCONTACTO']));
    if (!pid) continue;
    const fecha = clean(r['FECHA']);
    const hora  = clean(r['HORA']);
    const dateStr = fecha && hora ? new Date(`${fecha}T${hora}`).toISOString()
                  : fecha ? new Date(fecha).toISOString() : null;
    if (!dateStr) continue;

    const key = `${pid}|${dateStr}`;
    if (existingSet.has(key)) continue;
    existingSet.add(key);

    const parts = [];
    if (clean(r['HISTORIAL']))   parts.push(`[ALTA]: ${r['HISTORIAL']}`);
    if (clean(r['HISTORIA']))    parts.push(`[HISTORIA]: ${r['HISTORIA']}`);
    if (clean(r['EVOLUCION']))   parts.push(`[EVOLUCIÓN]: ${r['EVOLUCION']}`);
    if (clean(r['ANTECEDENTES'])) parts.push(`[ANTECEDENTES]: ${r['ANTECEDENTES']}`);
    if (clean(r['ALERGIA']))     parts.push(`[ALERGIAS CSV]: ${r['ALERGIA']}`);
    if (clean(r['ENFERMEDAD']))  parts.push(`[ENFERMEDAD]: ${r['ENFERMEDAD']}`);
    if (clean(r['ESPECIALIDAD'])) parts.push(`[ESPECIALIDAD]: ${r['ESPECIALIDAD']}`);
    const text = parts.join('\n').trim();
    if (!text) continue;

    records.push({
      id:        randomUUID(),
      patientId: pid,
      date:      dateStr,
      text,
    });
  }

  // CSV 2: simple evolution
  const evo2 = readCsv(FILES.evolution2);
  log(`  evolution2 rows: ${evo2.length}`);
  for (const r of evo2) {
    const pid = contactMap.get(clean(r['IDCONTACTO']));
    if (!pid) continue;
    const fechaRaw = clean(r['FECHA']);
    const dateStr  = fechaRaw ? new Date(fechaRaw).toISOString() : null;
    if (!dateStr) continue;

    const key = `${pid}|${dateStr}`;
    if (existingSet.has(key)) continue;
    existingSet.add(key);

    const parts = [];
    if (clean(r['HISTORIAL'])) parts.push(`[ALTA]: ${r['HISTORIAL']}`);
    if (clean(r['DETALLES']))  parts.push(`[DETALLES]: ${r['DETALLES']}`);
    const text = parts.join('\n').trim();
    if (!text) continue;

    records.push({
      id:        randomUUID(),
      patientId: pid,
      date:      dateStr,
      text,
    });
  }

  log(`  → ${records.length} new clinical records to insert`);
  if (records.length > 0) {
    const { inserted, errors } = await upsertBatch('ClinicalRecord', records, 'id', 300);
    log(`  ✔ Inserted: ${inserted} | Errors: ${errors}`);
  }
}

// ─── STEP 3: APPOINTMENTS ────────────────────────────────────────────────────
async function migrateAppointments(contactMap) {
  log('── STEP 3: Appointments ─────────────────────────────────────────');

  const rows = readCsv(FILES.appointments);
  log(`  CSV rows: ${rows.length}`);

  // Fetch existing appointments for dedup (patientId + date)
  const { data: existingAppts } = await supabase.from('Appointment').select('patientId, date');
  const existingSet = new Set(existingAppts.map(a => `${a.patientId}|${a.date}`));

  // Fetch doctors to resolve agenda → doctorId
  const { data: doctors } = await supabase.from('Doctor').select('id, name');
  const doctorByName = new Map(doctors.map(d => [d.name.toLowerCase().trim(), d.id]));

  function resolveDoctorId(agendaStr) {
    const a = clean(agendaStr).toLowerCase();
    // Exact match
    if (doctorByName.has(a)) return doctorByName.get(a);
    // Partial match
    for (const [k, v] of doctorByName) {
      if (a.includes(k) || k.includes(a)) return v;
    }
    return null;
  }

  function mapStatus(estadoStr) {
    const s = clean(estadoStr).toLowerCase();
    if (s === 'realizada') return 'Completed';
    if (s === 'cancelada') return 'Cancelled';
    if (s === 'pendiente') return 'Scheduled';
    return 'Scheduled';
  }

  const toInsert = [];
  let skipped = 0;

  for (const r of rows) {
    const pid = contactMap.get(clean(r['IDCONTACTO']));
    if (!pid) { skipped++; continue; }

    const fechaStr = clean(r['FECHA']);
    const horaStr  = clean(r['HORA INICIO']);
    const dateStr  = fechaStr ? new Date(`${fechaStr}T${horaStr || '00:00:00'}`).toISOString() : null;
    if (!dateStr) { skipped++; continue; }

    const key = `${pid}|${dateStr}`;
    if (existingSet.has(key)) { skipped++; continue; }
    existingSet.add(key);

    const doctorId = resolveDoctorId(r['AGENDA']);
    if (!doctorId) { skipped++; continue; } // doctorId is required FK

    const horaFin     = clean(r['HORA FIN']);
    let durationMins  = 60;
    if (horaStr && horaFin) {
      const [sh, sm] = horaStr.split(':').map(Number);
      const [eh, em] = horaFin.split(':').map(Number);
      durationMins   = Math.max(15, (eh * 60 + em) - (sh * 60 + sm));
    }

    toInsert.push({
      id:          randomUUID(),
      date:        dateStr,
      time:        horaStr || '00:00',
      duration:    durationMins,
      status:      mapStatus(r['ESTADO']),
      observations: clean(r['ASUNTO']) || null,
      visitDetails: clean(r['DETALLES']) || null,
      patientId:   pid,
      doctorId,
      treatmentName: clean(r['SERVICIOS']) || null,
      amount:      parseFloat(clean(r['IMPORTE CITA'])) || 0,
      paid:        false,
    });
  }

  log(`  → ${toInsert.length} new appointments | ${skipped} skipped`);
  if (toInsert.length > 0) {
    const { inserted, errors } = await upsertBatch('Appointment', toInsert, 'id', 250);
    log(`  ✔ Inserted: ${inserted} | Errors: ${errors}`);
  }
}

// ─── STEP 4: BUDGETS ─────────────────────────────────────────────────────────
async function migrateBudgets(contactMap) {
  log('── STEP 4: Budgets + BudgetLineItems ────────────────────────────');

  const rows = readCsv(FILES.budgets);
  log(`  CSV rows: ${rows.length}`);

  // Fetch existing budgets to dedup (title)
  const { data: existingBudgets } = await supabase.from('Budget').select('id, title, patientId');
  const existingTitles = new Map(existingBudgets.map(b => [`${b.patientId}|${b.title}`, b.id]));

  // Group rows by NÚMERO (budget number)
  const budgetGroups = new Map();
  for (const r of rows) {
    const num = clean(r['NÚMERO']);
    if (!num) continue;
    if (!budgetGroups.has(num)) budgetGroups.set(num, []);
    budgetGroups.get(num).push(r);
  }

  log(`  Unique budget numbers: ${budgetGroups.size}`);

  const budgetsToInsert = [];
  const lineItemsToInsert = [];
  let skippedBudgets = 0;

  for (const [budgetNum, lines] of budgetGroups) {
    const first = lines[0];
    const pid = contactMap.get(clean(first['IDCONTACTO']));
    if (!pid) { skippedBudgets++; continue; }

    const title = `Presupuesto N. ${budgetNum}`;
    const mapKey = `${pid}|${title}`;

    let budgetId;
    if (existingTitles.has(mapKey)) {
      budgetId = existingTitles.get(mapKey);
      // Budget already exists, still process line items
    } else {
      budgetId = randomUUID();
      existingTitles.set(mapKey, budgetId);

      const fechaStr = parseDate(first['FECHA']);
      const aceptado = clean(first['ACEPTADO']).toLowerCase();
      const status   = aceptado === 'sí' || aceptado === 'si' ? 'ACCEPTED' : 'DRAFT';
      const total    = parseFloat(clean(first['TOTAL PRESUPUESTO'])) || 0;

      budgetsToInsert.push({
        id:          budgetId,
        patientId:   pid,
        title,
        date:        fechaStr || new Date().toISOString(),
        status,
        totalAmount: total,
        createdAt:   fechaStr || new Date().toISOString(),
        updatedAt:   new Date().toISOString(),
      });
    }

    for (const line of lines) {
      const serviceName = clean(line['CONCEPTO']) || clean(line['SERVICIO/PRODUCTO']);
      if (!serviceName) continue;
      const basePrice = parseFloat(clean(line['TOTAL CONCEPTO'])) || 0;
      const qty       = parseInt(clean(line['CANTIDAD'])) || 1;
      const pieza     = clean(line['PIEZA']);
      const descuento = parseFloat(clean(line['DESCUENTO'])) || 0;
      const unitPrice = qty > 0 ? basePrice / qty : basePrice;

      lineItemsToInsert.push({
        id:       randomUUID(),
        budgetId,
        name:     serviceName,
        price:    Math.max(0, unitPrice - (unitPrice * descuento / 100)),
        quantity: qty,
        tooth:    pieza || null,
      });
    }
  }

  log(`  → ${budgetsToInsert.length} budgets to insert | ${skippedBudgets} skipped`);
  log(`  → ${lineItemsToInsert.length} budget line items to insert`);

  if (budgetsToInsert.length > 0) {
    const { inserted, errors } = await upsertBatch('Budget', budgetsToInsert, 'id');
    log(`  ✔ Budgets inserted: ${inserted} | Errors: ${errors}`);
  }
  if (lineItemsToInsert.length > 0) {
    const { inserted, errors } = await upsertBatch('BudgetLineItem', lineItemsToInsert, 'id', 300);
    log(`  ✔ BudgetLineItems inserted: ${inserted} | Errors: ${errors}`);
  }

  return existingTitles; // not needed downstream but kept for reference
}

// ─── STEP 5: INVOICES ────────────────────────────────────────────────────────
async function migrateInvoices(contactMap) {
  log('── STEP 5: Invoices + InvoiceItems ──────────────────────────────');

  const rows = readCsv(FILES.invoices);
  log(`  CSV rows: ${rows.length}`);

  // Fetch existing invoices by externalId to dedup
  const { data: existingInvoices } = await supabase.from('Invoice').select('id, externalId');
  const existingExternal = new Map(existingInvoices.filter(i => i.externalId).map(i => [i.externalId, i.id]));

  // Group by NUMERO
  const invoiceGroups = new Map();
  for (const r of rows) {
    const num = clean(r['NUMERO']);
    if (!num) continue;
    if (!invoiceGroups.has(num)) invoiceGroups.set(num, []);
    invoiceGroups.get(num).push(r);
  }

  log(`  Unique invoice numbers: ${invoiceGroups.size}`);

  const invoicesToInsert = [];
  const itemsToInsert    = [];
  const invoiceIdMap     = new Map(); // NUMERO → Invoice.id
  let skipped = 0;

  for (const [invoiceNum, lines] of invoiceGroups) {
    if (existingExternal.has(invoiceNum)) {
      invoiceIdMap.set(invoiceNum, existingExternal.get(invoiceNum));
      skipped++;
      continue;
    }

    const first = lines[0];
    const pid = contactMap.get(clean(first['IDCONTACTO']));
    if (!pid) { skipped++; continue; }

    const invoiceId = randomUUID();
    existingExternal.set(invoiceNum, invoiceId);
    invoiceIdMap.set(invoiceNum, invoiceId);

    const total = lines.reduce((s, l) => s + (parseFloat(clean(l['IMPORTE'])) || 0), 0);
    const dateStr = parseDate(first['FECHA']) || new Date().toISOString();
    const tipo    = clean(first['TIPO']).toLowerCase();

    invoicesToInsert.push({
      id:            invoiceId,
      invoiceNumber: invoiceNum,
      patientId:     pid,
      amount:        total,
      date:          dateStr,
      status:        'paid',
      paymentMethod: null,
      externalId:    invoiceNum,
      concept:       clean(first['DETALLES']) || null,
    });

    for (const line of lines) {
      const name  = clean(line['SERVICIO']) || clean(line['DETALLES']) || 'Servicio';
      const price = parseFloat(clean(line['IMPORTE'])) || 0;

      itemsToInsert.push({
        id:        randomUUID(),
        invoiceId,
        name,
        price,
      });
    }
  }

  log(`  → ${invoicesToInsert.length} invoices to insert | ${skipped} skipped (existing)`);
  log(`  → ${itemsToInsert.length} invoice items to insert`);

  if (invoicesToInsert.length > 0) {
    const { inserted, errors } = await upsertBatch('Invoice', invoicesToInsert, 'id');
    log(`  ✔ Invoices inserted: ${inserted} | Errors: ${errors}`);
  }
  if (itemsToInsert.length > 0) {
    const { inserted, errors } = await upsertBatch('InvoiceItem', itemsToInsert, 'id', 300);
    log(`  ✔ InvoiceItems inserted: ${inserted} | Errors: ${errors}`);
  }

  return invoiceIdMap;
}

// ─── STEP 6: PAYMENTS (CAJA) ─────────────────────────────────────────────────
async function migratePayments(contactMap, invoiceIdMap) {
  log('── STEP 6: Payments (Caja) ──────────────────────────────────────');

  const rows = readCsv(FILES.caja);
  log(`  CSV rows: ${rows.length}`);

  // Dedup by sourcePaymentId (ID_APUNTE stored there)
  const { data: existingPays } = await supabase.from('Payment').select('sourcePaymentId');
  const existingApuntes = new Set(existingPays.filter(p => p.sourcePaymentId).map(p => p.sourcePaymentId));

  const toInsert = [];
  let skipped = 0;

  for (const r of rows) {
    const apunteId = clean(r['ID_APUNTE']);
    if (!apunteId) { skipped++; continue; }
    if (existingApuntes.has(apunteId)) { skipped++; continue; }
    existingApuntes.add(apunteId);

    const pid = contactMap.get(clean(r['ID_CONTACTO']));
    if (!pid) { skipped++; continue; }

    const invoiceNum = clean(r['FACTURA']);
    const invoiceId  = invoiceIdMap.get(invoiceNum) || null;

    const importe    = parseFloat(clean(r['IMPORTE'])) || 0;
    const tipo       = clean(r['TIPO']);           // Ingreso / Egreso
    const forma      = clean(r['FORMA']);          // Tarjeta / Efectivo / Transferencia
    const dateStr    = parseDate(r['FECHA']) || new Date().toISOString();
    const detalles   = clean(r['DETALLES']);

    toInsert.push({
      id:              randomUUID(),
      patientId:       pid,
      invoiceId,
      amount:          Math.abs(importe),
      method:          forma || 'Desconocido',
      type:            tipo === 'Ingreso' ? 'INCOME' : 'EXPENSE',
      sourcePaymentId: apunteId,
      notes:           detalles || null,
      createdAt:       dateStr,
    });
  }

  log(`  → ${toInsert.length} payments to insert | ${skipped} skipped`);
  if (toInsert.length > 0) {
    const { inserted, errors } = await upsertBatch('Payment', toInsert, 'id', 300);
    log(`  ✔ Inserted: ${inserted} | Errors: ${errors}`);
  }
}

// ─── STEP 7: INVENTORY ───────────────────────────────────────────────────────
async function migrateInventory() {
  log('── STEP 7: InventoryItems ───────────────────────────────────────');

  const rows = readCsv(FILES.products);
  log(`  CSV rows: ${rows.length}`);

  // Dedup by name+category
  const { data: existing } = await supabase.from('InventoryItem').select('name, category');
  const existingSet = new Set(existing.map(i => `${i.name}|${i.category}`));

  const toInsert = [];
  for (const r of rows) {
    const name     = clean(r['PRODUCTO']) || clean(r['DESCRIPCION']);
    const category = clean(r['PROVEEDOR']) || 'General';
    if (!name) continue;
    const key = `${name}|${category}`;
    if (existingSet.has(key)) continue;
    existingSet.add(key);

    const estado   = clean(r['ESTADO']).toLowerCase(); // Alta/Baja
    const cantidad = parseInt(clean(r['UNIDADES'])) || 0;
    const prCosto  = parseFloat(clean(r['PRECIO COSTO'])) || 0;
    const aviso1   = parseInt(clean(r['AVISO 1'])) || 5;

    toInsert.push({
      id:       randomUUID(),
      name,
      category,
      quantity: cantidad,
      minStock: aviso1,
      unit:     'ud',
    });
  }

  log(`  → ${toInsert.length} products to insert`);
  if (toInsert.length > 0) {
    const { inserted, errors } = await upsertBatch('InventoryItem', toInsert, 'id');
    log(`  ✔ Inserted: ${inserted} | Errors: ${errors}`);
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  log('╔══════════════════════════════════════════════════════════════╗');
  log('║   MIGRACIÓN CSV → SUPABASE — CHC Clínica Dental             ║');
  log('║   Proyecto: gnnacijqglcqonholpwt                            ║');
  log('╚══════════════════════════════════════════════════════════════╝');

  try {
    // Step 1 — Patients (builds the contact map)
    const contactMap = await migratePatients();

    // Step 2 — Clinical records
    await migrateClinicalRecords(contactMap);

    // Step 3 — Appointments
    await migrateAppointments(contactMap);

    // Step 4 — Budgets
    await migrateBudgets(contactMap);

    // Step 5 — Invoices (returns invoice number → id map)
    const invoiceIdMap = await migrateInvoices(contactMap);

    // Step 6 — Payments
    await migratePayments(contactMap, invoiceIdMap);

    // Step 7 — Inventory
    await migrateInventory();

    log('');
    log('╔══════════════════════════════════════════════════════════════╗');
    log('║   ✅  MIGRACIÓN COMPLETADA                                  ║');
    log('╚══════════════════════════════════════════════════════════════╝');
  } catch (err) {
    console.error('FATAL:', err);
    process.exit(1);
  }
}

main();
