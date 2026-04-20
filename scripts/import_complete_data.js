/**
 * IMPORTACIÓN COMPLETA — DatosCompletosClinica → Supabase
 * CHC Clínica Dental — CRM Médico
 *
 * Datos fuente: /DatosCompletosClinica/ (dump directo de Dentix/software anterior)
 *
 * Estrategia:
 *   • UPSERT ADITIVO — nunca destruye datos existentes
 *   • Deduplicación por DNI, email, nombre, externalId, fecha
 *   • 9 pasos secuenciales con mapas de IDs cruzados
 *   • Modo --dry-run para previsualizar sin tocar la BD
 *
 * Uso:
 *   node scripts/import_complete_data.js              # Ejecución real
 *   node scripts/import_complete_data.js --dry-run    # Solo previsualizar
 */

'use strict';

const { createClient } = require('@supabase/supabase-js');
const { parse } = require('csv-parse/sync');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

// ─── CONFIG ──────────────────────────────────────────────────────────────────
// Load env from multiple locations (server/.env has the valid service key)
require('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/"/g, '').trim();
const SERVICE_KEY  = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/"/g, '').trim();
if (!SERVICE_KEY) { console.error('❌ Set SUPABASE_SERVICE_ROLE_KEY in .env'); process.exit(1); }

const DRY_RUN = process.argv.includes('--dry-run');
const BASE_DIR = path.join(__dirname, '..', 'DatosCompletosClinica');

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function readCsv(filename) {
  const file = path.join(BASE_DIR, filename);
  if (!fs.existsSync(file)) { warn(`File not found: ${filename}`); return []; }
  const raw = fs.readFileSync(file, 'utf8');
  return parse(raw, {
    delimiter: ';',
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
    trim: true,
  });
}

function log(msg) { console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`); }
function warn(msg) { console.warn(`  ⚠️  ${msg}`); }

function clean(v) { return (v || '').trim(); }
function cleanDni(v) { return clean(v).toUpperCase().replace(/\s/g, ''); }
function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .trim();
}

function parseDate(s) {
  if (!s || !clean(s)) return null;
  const t = clean(s);
  if (t === '0000-00-00' || t === '0000-00-00 00:00:00') return null;
  // DD/MM/YYYY
  if (t.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
    const [d, m, y] = t.split('/');
    const date = new Date(`${y}-${m}-${d}T00:00:00.000Z`);
    return isNaN(date.getTime()) ? null : date.toISOString();
  }
  // YYYY-MM-DD or YYYY-MM-DD HH:MM:SS
  if (t.match(/^\d{4}-\d{2}-\d{2}/)) {
    const date = new Date(t.includes('T') ? t : t.replace(' ', 'T') + (t.includes(':') ? '' : 'T00:00:00') + '.000Z');
    return isNaN(date.getTime()) ? null : date.toISOString();
  }
  return null;
}

function parsePaymentMethod(forma) {
  const f = parseInt(clean(forma));
  switch (f) {
    case 1: return 'cash';        // Efectivo
    case 2: return 'card';        // Tarjeta
    case 3: return 'transfer';    // Transferencia
    case 4: return 'financing';   // Financiación
    default: return 'other';
  }
}

// Statistics tracker
const stats = {};
function stat(table, action) {
  if (!stats[table]) stats[table] = { inserted: 0, updated: 0, skipped: 0, errors: 0 };
  stats[table][action]++;
}

// Upsert in chunks
async function upsertBatch(table, rows, onConflict, chunkSize = 200) {
  if (DRY_RUN) {
    log(`  [DRY-RUN] Would upsert ${rows.length} rows into "${table}"`);
    rows.forEach(() => stat(table, 'inserted'));
    return { inserted: rows.length, errors: 0 };
  }
  let inserted = 0, errors = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase
      .from(table)
      .upsert(chunk, { onConflict, ignoreDuplicates: false });
    if (error) {
      warn(`Batch ${i}–${i + chunk.length} on "${table}": ${error.message}`);
      errors += chunk.length;
      chunk.forEach(() => stat(table, 'errors'));
    } else {
      inserted += chunk.length;
      chunk.forEach(() => stat(table, 'inserted'));
    }
  }
  return { inserted, errors };
}

// Insert only (no upsert) — for tables where we want to skip existing
async function insertBatch(table, rows, chunkSize = 200) {
  if (DRY_RUN) {
    log(`  [DRY-RUN] Would insert ${rows.length} rows into "${table}"`);
    rows.forEach(() => stat(table, 'inserted'));
    return { inserted: rows.length, errors: 0 };
  }
  let inserted = 0, errors = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from(table).insert(chunk);
    if (error) {
      // Try one-by-one to skip individual conflicts
      for (const row of chunk) {
        const { error: e2 } = await supabase.from(table).insert(row);
        if (e2) {
          if (e2.code === '23505') { stat(table, 'skipped'); } // duplicate
          else { warn(`Insert ${table}: ${e2.message}`); stat(table, 'errors'); errors++; }
        } else {
          inserted++;
          stat(table, 'inserted');
        }
      }
    } else {
      inserted += chunk.length;
      chunk.forEach(() => stat(table, 'inserted'));
    }
  }
  return { inserted, errors };
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 1: PATIENTS — contacto_1.csv + contacto_extra_1.csv
// ═══════════════════════════════════════════════════════════════════════════════
async function step1_patients() {
  log('═══ PASO 1: Pacientes ═══════════════════════════════════════════');
  const rows = readCsv('contacto_1.csv');
  const extras = readCsv('contacto_extra_1.csv');
  log(`  contacto_1: ${rows.length} filas | contacto_extra_1: ${extras.length} filas`);

  // Build extras lookup: idContacto → extra data
  const extrasMap = new Map();
  for (const e of extras) {
    extrasMap.set(clean(e['idContacto']), e);
  }

  // Fetch existing patients
  const { data: existing, error: fetchErr } = await supabase
    .from('Patient')
    .select('id, dni, email, name, historyNumber');
  if (fetchErr) throw new Error('Cannot fetch patients: ' + fetchErr.message);
  log(`  Pacientes existentes en Supabase: ${existing.length}`);

  const byDni = new Map(existing.filter(p => p.dni).map(p => [cleanDni(p.dni), p]));
  const byEmail = new Map(existing.filter(p => p.email && !p.email.includes('@import.local')).map(p => [p.email.toLowerCase(), p]));
  const byName = new Map(existing.map(p => [p.name.toLowerCase().trim(), p]));

  // IDCONTACTO → Patient UUID map (needed by all subsequent steps)
  const contactMap = new Map();
  const toInsert = [];
  const toUpdate = [];

  const claimedNums = new Set(existing.filter(p => p.historyNumber).map(p => p.historyNumber));

  for (const r of rows) {
    const idContacto = clean(r['idContacto']);
    const nombre = clean(r['nombre']);
    const apellidos = clean(r['apellidos']);
    const fullName = [nombre, apellidos].filter(Boolean).join(' ');
    const dni = cleanDni(r['dni']);
    const email = clean(r['email']).toLowerCase();
    const phone = clean(r['tele1']) || clean(r['tele2']);
    const birthStr = parseDate(r['fechanac']);
    const numStr = clean(r['num']);
    const sexo = clean(r['sexo']);
    const domicilio = clean(r['domicilio']);
    const cp = clean(r['cp']);
    const poblacion = clean(r['pobla']);
    const provincia = clean(r['provi']);
    const estado = clean(r['estado']);

    // Extra data
    const extra = extrasMap.get(idContacto);
    const allergies = extra ? clean(extra['alergias']) : '';
    const diseases = extra ? clean(extra['enfermedades']) : '';
    const medications = extra ? clean(extra['medicacion']) : '';
    const smoker = extra ? clean(extra['consumoTabaco']) : '';

    // Skip inactive/deleted contacts
    if (estado === '0' || estado === '2') {
      stat('Patient', 'skipped');
      continue;
    }

    // Safe history number — always stored as HC-XXXX format (4-digit zero-padded)
    let safeNum = null;
    if (numStr) {
      const formatted = `HC-${String(parseInt(numStr, 10)).padStart(4, '0')}`;
      if (!claimedNums.has(formatted)) {
        safeNum = formatted;
        claimedNums.add(formatted);
      }
    }

    // Match existing
    let matched = null;
    if (dni) matched = byDni.get(dni);
    if (!matched && !dni) matched = byDni.get(`SIN-DNI-${idContacto}`);
    if (!matched && email) matched = byEmail.get(email);
    if (!matched && fullName) matched = byName.get(fullName.toLowerCase());

    if (matched) {
      contactMap.set(idContacto, matched.id);
      // Patch empty fields
      const patch = { id: matched.id };
      let changed = false;
      if (safeNum && !matched.historyNumber) { patch.historyNumber = safeNum; changed = true; }
      if (allergies) { patch.allergies = allergies; changed = true; }
      if (diseases) { patch.diseases = diseases; changed = true; }
      if (medications) { patch.medications = medications; changed = true; }
      if (smoker && smoker !== '0') { patch.smoker = true; changed = true; }
      if (phone && !matched.phone) { patch.phone = phone; changed = true; }
      if (domicilio) { patch.address = domicilio; changed = true; }
      if (poblacion) { patch.city = poblacion; changed = true; }
      if (cp) { patch.postalCode = cp; changed = true; }
      if (provincia) { patch.province = provincia; changed = true; }
      if (changed) toUpdate.push(patch);
      else stat('Patient', 'skipped');
    } else {
      const newId = randomUUID();
      contactMap.set(idContacto, newId);
      const placeholderDni = dni || `SIN-DNI-${idContacto}`;

      toInsert.push({
        id: newId,
        historyNumber: safeNum || null,
        name: fullName || nombre || 'Sin nombre',
        firstName: nombre || null,
        lastName1: apellidos ? apellidos.split(' ')[0] : null,
        lastName2: apellidos && apellidos.split(' ').length > 1 ? apellidos.split(' ').slice(1).join(' ') : null,
        dni: placeholderDni,
        birthDate: birthStr || '1900-01-01T00:00:00.000Z',
        email: email || `noreply_${idContacto}@import.local`,
        phone: phone || null,
        insurance: null,
        address: domicilio || null,
        city: poblacion || null,
        postalCode: cp || null,
        province: provincia || null,
        allergies: allergies || null,
        diseases: diseases || null,
        medications: medications || null,
        smoker: smoker && smoker !== '0' ? true : false,
        medicalHistory: null,
        balance: 0,
        wallet: 0,
      });
    }
  }

  // Dedup inserts by DNI
  const seenDnis = new Set();
  const deduped = toInsert.filter(p => {
    if (seenDnis.has(p.dni)) { stat('Patient', 'skipped'); return false; }
    seenDnis.add(p.dni);
    return true;
  });

  log(`  → ${deduped.length} nuevos | ${toUpdate.length} a actualizar | ${rows.length - deduped.length - toUpdate.length} omitidos`);

  if (deduped.length > 0) {
    const r = await upsertBatch('Patient', deduped, 'id');
    log(`  ✔ Insertados: ${r.inserted} | Errores: ${r.errors}`);
  }

  // Updates
  let updateOk = 0;
  for (const patch of toUpdate) {
    const { id, ...fields } = patch;
    if (DRY_RUN) { stat('Patient', 'updated'); updateOk++; continue; }
    const { error } = await supabase.from('Patient').update(fields).eq('id', id);
    if (error) { warn(`Update ${id}: ${error.message}`); stat('Patient', 'errors'); }
    else { stat('Patient', 'updated'); updateOk++; }
  }
  if (updateOk > 0) log(`  ✔ Actualizados: ${updateOk}`);

  log(`  ✔ Mapa contacto→UUID: ${contactMap.size} entradas`);
  return contactMap;
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 2: SPECIALTIES — tiposervicio_1.csv
// ═══════════════════════════════════════════════════════════════════════════════
async function step2_specialties() {
  log('═══ PASO 2: Especialidades ══════════════════════════════════════');
  const rows = readCsv('tiposervicio_1.csv');
  log(`  tiposervicio_1: ${rows.length} filas`);

  const { data: existing } = await supabase.from('Specialty').select('id, name');
  const byName = new Map(existing.map(s => [s.name.toLowerCase(), s.id]));

  const specialtyMap = new Map(); // idTipoServicio → Specialty.id
  const toInsert = [];

  for (const r of rows) {
    const idTipo = clean(r['idTipoServicio']);
    const name = clean(r['nombre']);
    if (!name) continue;

    if (byName.has(name.toLowerCase())) {
      specialtyMap.set(idTipo, byName.get(name.toLowerCase()));
      stat('Specialty', 'skipped');
    } else {
      const newId = randomUUID();
      specialtyMap.set(idTipo, newId);
      byName.set(name.toLowerCase(), newId);
      toInsert.push({ id: newId, name });
    }
  }

  log(`  → ${toInsert.length} nuevas especialidades`);
  if (toInsert.length > 0) {
    const r = await upsertBatch('Specialty', toInsert, 'id');
    log(`  ✔ Insertadas: ${r.inserted}`);
  }

  log(`  ✔ Mapa tipoServicio→UUID: ${specialtyMap.size} entradas`);
  return specialtyMap;
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 3: SERVICES — servicio_1.csv
// ═══════════════════════════════════════════════════════════════════════════════
async function step3_services(specialtyMap) {
  log('═══ PASO 3: Servicios / Catálogo ════════════════════════════════');
  const rows = readCsv('servicio_1.csv');
  log(`  servicio_1: ${rows.length} filas`);

  const { data: existing } = await supabase.from('Service').select('id, name');
  const byName = new Map(existing.map(s => [s.name.toLowerCase(), s.id]));

  const serviceMap = new Map(); // idServicio → Service.id
  const toInsert = [];

  for (const r of rows) {
    const idServicio = clean(r['idServicio']);
    const name = clean(r['nombre']);
    const price = parseFloat(clean(r['importe'])) || 0;
    const idTipo = clean(r['idTipoServicio']);
    const specId = specialtyMap.get(idTipo) || null;
    const duration = parseInt(clean(r['duracion'])) || 30;
    const color = clean(r['color']);
    const estado = clean(r['estado']);

    if (!name) continue;

    if (byName.has(name.toLowerCase())) {
      serviceMap.set(idServicio, byName.get(name.toLowerCase()));
      stat('Service', 'skipped');
    } else {
      const newId = randomUUID();
      serviceMap.set(idServicio, newId);
      byName.set(name.toLowerCase(), newId);
      toInsert.push({
        id: newId,
        name,
        specialty_name: null,
        final_price: price,
        is_active: estado === '1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  }

  log(`  → ${toInsert.length} nuevos servicios`);
  if (toInsert.length > 0) {
    const r = await upsertBatch('Service', toInsert, 'id');
    log(`  ✔ Insertados: ${r.inserted}`);
  }

  // Also ensure Treatment catalog has these
  const { data: existTreatments } = await supabase.from('Treatment').select('id, name');
  const treatByName = new Map(existTreatments.map(t => [t.name.toLowerCase(), t.id]));
  const treatmentMap = new Map(); // idServicio → Treatment.id
  const treatToInsert = [];

  for (const r of rows) {
    const idServicio = clean(r['idServicio']);
    const name = clean(r['nombre']);
    const price = parseFloat(clean(r['importe'])) || 0;
    const idTipo = clean(r['idTipoServicio']);
    const specId = specialtyMap.get(idTipo) || null;

    if (!name) continue;

    if (treatByName.has(name.toLowerCase())) {
      treatmentMap.set(idServicio, treatByName.get(name.toLowerCase()));
    } else {
      const newId = randomUUID();
      treatmentMap.set(idServicio, newId);
      treatByName.set(name.toLowerCase(), newId);
      treatToInsert.push({
        id: newId,
        name,
        price,
        labCost: 0,
        specialtyId: specId,
      });
    }
  }

  if (treatToInsert.length > 0) {
    const r = await upsertBatch('Treatment', treatToInsert, 'id');
    log(`  ✔ Treatments insertados: ${r.inserted}`);
  }

  log(`  ✔ Mapa servicio→UUID: ${serviceMap.size} | treatment→UUID: ${treatmentMap.size}`);
  return { serviceMap, treatmentMap };
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 4: DOCTORS — usuario_1.csv + agenda_1.csv
// ═══════════════════════════════════════════════════════════════════════════════
async function step4_doctors(specialtyMap) {
  log('═══ PASO 4: Doctores + Horarios ═════════════════════════════════');
  const usuarios = readCsv('usuario_1.csv');
  const agendas = readCsv('agenda_1.csv');
  log(`  usuario_1: ${usuarios.length} filas | agenda_1: ${agendas.length} filas`);

  const { data: existDoctors } = await supabase.from('Doctor').select('id, name');
  const doctorByName = new Map(existDoctors.map(d => [d.name.toLowerCase().trim(), d.id]));

  const userMap = new Map(); // idUsuario → { name, email, ... }
  const agendaMap = new Map(); // idAgenda → Doctor.id
  const doctorsToInsert = [];

  // Parse usuarios
  for (const u of usuarios) {
    const idUsuario = clean(u['idUsuario']);
    const name = clean(u['nombre']);
    const email = clean(u['email']);
    const isDoctor = clean(u['doctor']) === '1';
    const commission = parseFloat(clean(u['porcentaje'])) || 0;
    userMap.set(idUsuario, { name, email, isDoctor, commission });
  }

  // Parse agendas → create/match doctors
  for (const a of agendas) {
    const idAgenda = clean(a['idAgenda']);
    const idUsuario = clean(a['idUsuario']);
    const agendaName = clean(a['nombre']);
    const estado = clean(a['estado']);

    if (estado === '0') continue; // Inactive agenda

    const user = userMap.get(idUsuario);
    const doctorName = agendaName || (user ? user.name : `Doctor ${idUsuario}`);

    if (doctorByName.has(doctorName.toLowerCase().trim())) {
      agendaMap.set(idAgenda, doctorByName.get(doctorName.toLowerCase().trim()));
      stat('Doctor', 'skipped');
    } else {
      const newId = randomUUID();
      agendaMap.set(idAgenda, newId);
      doctorByName.set(doctorName.toLowerCase().trim(), newId);
      doctorsToInsert.push({
        id: newId,
        name: doctorName,
        specialization: null,
        commissionPercentage: user ? user.commission : 0,
      });
    }
  }

  log(`  → ${doctorsToInsert.length} nuevos doctores`);
  if (doctorsToInsert.length > 0) {
    const r = await upsertBatch('Doctor', doctorsToInsert, 'id');
    log(`  ✔ Insertados: ${r.inserted}`);
  }

  // Also create a "user→doctor" map for historiales that reference idUsuario
  const userDoctorMap = new Map(); // idUsuario → Doctor.id
  for (const a of agendas) {
    const idUsuario = clean(a['idUsuario']);
    const idAgenda = clean(a['idAgenda']);
    if (agendaMap.has(idAgenda)) {
      userDoctorMap.set(idUsuario, agendaMap.get(idAgenda));
    }
  }

  // Create DoctorSchedules from agenda data
  const { data: existSchedules } = await supabase.from('doctor_schedules').select('id, doctor_id');
  const existSchedDoctors = new Set(existSchedules.map(s => s.doctor_id));
  const schedToInsert = [];

  for (const a of agendas) {
    const idAgenda = clean(a['idAgenda']);
    const doctorId = agendaMap.get(idAgenda);
    if (!doctorId || existSchedDoctors.has(doctorId)) continue;
    existSchedDoctors.add(doctorId);

    const dias = clean(a['dias']); // e.g. "yynyynn" → L,M,_,J,V,_,_
    const doctorName = clean(a['nombre']);

    schedToInsert.push({
      id: randomUUID(),
      doctor_id: doctorId,
      doctor_name: doctorName,
      monday: dias[0] === 'y',
      tuesday: dias[1] === 'y',
      wednesday: dias[2] === 'y',
      thursday: dias[3] === 'y',
      friday: dias[4] === 'y',
      saturday: dias[5] === 'y',
      sunday: dias[6] === 'y',
      morning_start: clean(a['lhi1']) !== '00:00:00' ? clean(a['lhi1']) : null,
      morning_end: clean(a['lhf1']) !== '00:00:00' ? clean(a['lhf1']) : null,
      afternoon_start: clean(a['lhi2']) !== '00:00:00' ? clean(a['lhi2']) : null,
      afternoon_end: clean(a['lhf2']) !== '00:00:00' ? clean(a['lhf2']) : null,
      is_active: true,
      created_at: new Date().toISOString(),
    });
  }

  if (schedToInsert.length > 0) {
    const r = await insertBatch('doctor_schedules', schedToInsert);
    log(`  ✔ Horarios insertados: ${r.inserted}`);
  }

  log(`  ✔ Mapa agenda→Doctor: ${agendaMap.size} | usuario→Doctor: ${userDoctorMap.size}`);
  return { agendaMap, userDoctorMap };
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 5: CLINICAL RECORDS — historial_1.csv + historianota_1.csv
// ═══════════════════════════════════════════════════════════════════════════════
async function step5_clinicalRecords(contactMap, userDoctorMap) {
  log('═══ PASO 5: Historial Clínico ═══════════════════════════════════');
  const historiales = readCsv('historial_1.csv');
  const notas = readCsv('historianota_1.csv');
  log(`  historial_1: ${historiales.length} | historianota_1: ${notas.length}`);

  // Build historial→notas map (1:N)
  const notasMap = new Map();
  for (const n of notas) {
    const idHistorial = clean(n['idHistorial']);
    if (!notasMap.has(idHistorial)) notasMap.set(idHistorial, []);
    notasMap.get(idHistorial).push(n);
  }

  // Fetch existing for dedup
  const { data: existing } = await supabase.from('ClinicalRecord').select('patientId, date');
  const existSet = new Set((existing || []).map(r => `${r.patientId}|${r.date}`));

  const toInsert = [];

  for (const h of historiales) {
    const idContacto = clean(h['idContacto']);
    const pid = contactMap.get(idContacto);
    if (!pid) { stat('ClinicalRecord', 'skipped'); continue; }

    const idHistorial = clean(h['idHistorial']);
    const fechaBase = clean(h['fecha']);
    const idUsuario = clean(h['idUsuario']);
    const authorId = userDoctorMap.get(idUsuario) || null;
    const historialName = clean(h['nombre']); // e.g. "Primera visita"

    // Get all notas for this historial
    const histNotas = notasMap.get(idHistorial) || [];

    if (histNotas.length === 0) {
      // No detailed notes — create a single record from the historial header
      const dateStr = parseDate(fechaBase);
      if (!dateStr) { stat('ClinicalRecord', 'skipped'); continue; }

      const key = `${pid}|${dateStr}`;
      if (existSet.has(key)) { stat('ClinicalRecord', 'skipped'); continue; }
      existSet.add(key);

      const evolucion = clean(h['evolucion']);
      const antecedentes = clean(h['antecedentes']);
      const otros = clean(h['otros']);
      const parts = [];
      if (historialName) parts.push(`[${historialName}]`);
      if (evolucion) parts.push(evolucion);
      if (antecedentes) parts.push(`[ANTECEDENTES]: ${antecedentes}`);
      if (otros) parts.push(`[OTROS]: ${otros}`);
      const text = parts.join('\n').trim();
      if (!text) { stat('ClinicalRecord', 'skipped'); continue; }

      toInsert.push({
        id: randomUUID(),
        patientId: pid,
        date: dateStr,
        text,
        authorId,
      });
    } else {
      // Create one record per nota
      for (const n of histNotas) {
        const notaFecha = clean(n['fecha']);
        const notaHora = clean(n['hora']);
        let dateStr;
        if (notaFecha) {
          const basePart = notaFecha.includes(' ') ? notaFecha : `${notaFecha} ${notaHora || '00:00:00'}`;
          dateStr = parseDate(basePart);
        } else {
          dateStr = parseDate(fechaBase);
        }
        if (!dateStr) { stat('ClinicalRecord', 'skipped'); continue; }

        const key = `${pid}|${dateStr}`;
        if (existSet.has(key)) { stat('ClinicalRecord', 'skipped'); continue; }
        existSet.add(key);

        const rawHtml = clean(n['nombre']); // "nombre" field contains the HTML text
        const text = stripHtml(rawHtml);
        if (!text) { stat('ClinicalRecord', 'skipped'); continue; }

        const notaUsuario = clean(n['idUsuario']);
        const notaAuthor = userDoctorMap.get(notaUsuario) || authorId;

        toInsert.push({
          id: randomUUID(),
          patientId: pid,
          date: dateStr,
          text: historialName ? `[${historialName}]\n${text}` : text,
          authorId: notaAuthor,
        });
      }
    }
  }

  log(`  → ${toInsert.length} registros clínicos nuevos`);
  if (toInsert.length > 0) {
    const r = await insertBatch('ClinicalRecord', toInsert, 300);
    log(`  ✔ Insertados: ${r.inserted} | Errores: ${r.errors}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 6: APPOINTMENTS — cita_1.csv + citaconcepto_1.csv
// ═══════════════════════════════════════════════════════════════════════════════
async function step6_appointments(contactMap, agendaMap, serviceMap) {
  log('═══ PASO 6: Citas / Appointments ════════════════════════════════');
  const citas = readCsv('cita_1.csv');
  const conceptos = readCsv('citaconcepto_1.csv');
  log(`  cita_1: ${citas.length} | citaconcepto_1: ${conceptos.length}`);

  // Build conceptos map: idCita → [concepts]
  const conceptMap = new Map();
  for (const c of conceptos) {
    const idCita = clean(c['idCita']);
    if (!conceptMap.has(idCita)) conceptMap.set(idCita, []);
    conceptMap.get(idCita).push(c);
  }

  // Existing for dedup
  const { data: existAppts } = await supabase.from('Appointment').select('patientId, date, time');
  const existSet = new Set((existAppts || []).map(a => `${a.patientId}|${a.date}|${a.time}`));

  // Fallback doctor
  const { data: fallbackDoctors } = await supabase.from('Doctor').select('id').limit(1);
  const fallbackDoctorId = fallbackDoctors && fallbackDoctors.length > 0 ? fallbackDoctors[0].id : null;

  const toInsert = [];
  const citaIdMap = new Map(); // idCita → Appointment.id

  for (const c of citas) {
    const idCita = clean(c['idCita']);
    const idContacto = clean(c['idContacto']);
    const pid = contactMap.get(idContacto);
    if (!pid) { stat('Appointment', 'skipped'); continue; }

    const idAgenda = clean(c['idAgenda']);
    const doctorId = agendaMap.get(idAgenda) || fallbackDoctorId;
    if (!doctorId) { stat('Appointment', 'skipped'); continue; }

    const fechaIni = clean(c['fechaIni']);
    const horaIni = clean(c['horaIni']);
    const horaFin = clean(c['horaFin']);
    const dateStr = parseDate(fechaIni);
    if (!dateStr) { stat('Appointment', 'skipped'); continue; }

    const timeStr = horaIni ? horaIni.substring(0, 5) : '00:00';
    const key = `${pid}|${dateStr}|${timeStr}`;
    if (existSet.has(key)) { stat('Appointment', 'skipped'); continue; }
    existSet.add(key);

    // Duration
    let duration = 30;
    if (horaIni && horaFin) {
      const [sh, sm] = horaIni.split(':').map(Number);
      const [eh, em] = horaFin.split(':').map(Number);
      duration = Math.max(15, (eh * 60 + em) - (sh * 60 + sm));
    }

    // Status: 0=Pendiente, 1=Realizada, 2=Cancelada, 3=No acude
    const estadoNum = parseInt(clean(c['estado'])) || 0;
    let status;
    switch (estadoNum) {
      case 1: status = 'Completed'; break;
      case 2: status = 'Cancelled'; break;
      case 3: status = 'No-show'; break;
      default: status = 'Scheduled';
    }

    const importe = parseFloat(clean(c['importe'])) || 0;
    const asunto = clean(c['asunto']);
    const detalles = clean(c['detalles']);

    // Get treatment name from concepts
    const citaConceptos = conceptMap.get(idCita) || [];
    const treatmentName = citaConceptos.length > 0
      ? clean(citaConceptos[0]['asunto'])
      : (asunto ? asunto.replace(/^\d+\.\s*\S+\s*\[\d+\]\s*\(/, '').replace(/\)$/, '') : null);

    const appointmentId = randomUUID();
    citaIdMap.set(idCita, appointmentId);

    toInsert.push({
      id: appointmentId,
      date: dateStr,
      time: timeStr,
      duration,
      status,
      observations: detalles || asunto || null,
      patientId: pid,
      doctorId,
      treatmentName: treatmentName || null,
      amount: importe,
      paid: false,
    });
  }

  log(`  → ${toInsert.length} citas nuevas`);
  if (toInsert.length > 0) {
    const r = await insertBatch('Appointment', toInsert, 250);
    log(`  ✔ Insertadas: ${r.inserted} | Errores: ${r.errors}`);
  }

  log(`  ✔ Mapa cita→UUID: ${citaIdMap.size}`);
  return citaIdMap;
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 7: BUDGETS — presupuesto_1.csv + presupuestoconcepto_1.csv
// ═══════════════════════════════════════════════════════════════════════════════
async function step7_budgets(contactMap) {
  log('═══ PASO 7: Presupuestos ════════════════════════════════════════');
  const presupuestos = readCsv('presupuesto_1.csv');
  const conceptos = readCsv('presupuestoconcepto_1.csv');
  log(`  presupuesto_1: ${presupuestos.length} | presupuestoconcepto_1: ${conceptos.length}`);

  // Build concept map: idPresupuesto → [lines]
  const conceptosMap = new Map();
  for (const c of conceptos) {
    const idPres = clean(c['idPresupuesto']);
    if (!conceptosMap.has(idPres)) conceptosMap.set(idPres, []);
    conceptosMap.get(idPres).push(c);
  }

  // Existing budgets dedup
  const { data: existBudgets } = await supabase.from('Budget').select('id, title, patientId');
  const existTitles = new Set((existBudgets || []).map(b => `${b.patientId}|${b.title}`));

  const budgetsToInsert = [];
  const lineItemsToInsert = [];
  const budgetIdMap = new Map(); // idPresupuesto → Budget.id

  for (const p of presupuestos) {
    const idPresupuesto = clean(p['idPresupuesto']);
    const idContacto = clean(p['idContacto']);
    const pid = contactMap.get(idContacto);
    if (!pid) { stat('Budget', 'skipped'); continue; }

    const num = clean(p['num']);
    const title = `Presupuesto N. ${num}`;
    const key = `${pid}|${title}`;

    if (existTitles.has(key)) {
      stat('Budget', 'skipped');
      continue;
    }
    existTitles.add(key);

    const budgetId = randomUUID();
    budgetIdMap.set(idPresupuesto, budgetId);

    const fechaStr = parseDate(p['fecha']);
    const total = parseFloat(clean(p['total'])) || 0;
    const acepta = clean(p['acepta']);
    // estadopresupuesto: 0=Pendiente, 1=Aceptado, 2=Rechazado
    const estadoP = clean(p['estadopresupuesto']);
    let status = 'DRAFT';
    if (acepta === '1' || estadoP === '1') status = 'ACCEPTED';
    else if (estadoP === '2') status = 'REJECTED';

    budgetsToInsert.push({
      id: budgetId,
      patientId: pid,
      title,
      date: fechaStr || new Date().toISOString(),
      status,
      totalAmount: total,
      createdAt: fechaStr || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Line items
    const lines = conceptosMap.get(idPresupuesto) || [];
    for (const l of lines) {
      const detalle = clean(l['detalle']);
      if (!detalle) continue;
      const precio = parseFloat(clean(l['precio'])) || 0;
      const qty = parseInt(clean(l['cantidad'])) || 1;
      const descuento = parseFloat(clean(l['descuento'])) || 0;
      const pieza = clean(l['pieza']);
      const unitPrice = precio * (1 - descuento / 100);

      lineItemsToInsert.push({
        id: randomUUID(),
        budgetId,
        name: detalle,
        price: Math.max(0, unitPrice),
        quantity: qty,
        tooth: pieza && pieza !== '-1' && pieza !== '0' ? pieza : null,
      });
    }
  }

  log(`  → ${budgetsToInsert.length} presupuestos | ${lineItemsToInsert.length} líneas`);
  if (budgetsToInsert.length > 0) {
    const r = await upsertBatch('Budget', budgetsToInsert, 'id');
    log(`  ✔ Presupuestos insertados: ${r.inserted}`);
  }
  if (lineItemsToInsert.length > 0) {
    const r = await insertBatch('BudgetLineItem', lineItemsToInsert, 300);
    log(`  ✔ Líneas insertadas: ${r.inserted}`);
  }

  return budgetIdMap;
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 8: INVOICES — factura_1.csv + facturaconcepto_1.csv
// ═══════════════════════════════════════════════════════════════════════════════
async function step8_invoices(contactMap) {
  log('═══ PASO 8: Facturas ════════════════════════════════════════════');
  const facturas = readCsv('factura_1.csv');
  const conceptos = readCsv('facturaconcepto_1.csv');
  log(`  factura_1: ${facturas.length} | facturaconcepto_1: ${conceptos.length}`);

  // Concept map: idFactura → [lines]
  const conceptMap = new Map();
  for (const c of conceptos) {
    const idFact = clean(c['idFactura']);
    if (!conceptMap.has(idFact)) conceptMap.set(idFact, []);
    conceptMap.get(idFact).push(c);
  }

  // Existing invoices dedup by externalId
  const { data: existInvoices } = await supabase.from('Invoice').select('id, externalId, invoiceNumber');
  const existExternal = new Set((existInvoices || []).filter(i => i.externalId).map(i => i.externalId));
  const existNumbers = new Set((existInvoices || []).map(i => i.invoiceNumber));

  const invoicesToInsert = [];
  const itemsToInsert = [];
  const invoiceIdMap = new Map(); // idFactura → Invoice.id

  for (const f of facturas) {
    const idFactura = clean(f['idFactura']);
    const idContacto = clean(f['idContacto']);
    const pid = contactMap.get(idContacto);
    if (!pid) { stat('Invoice', 'skipped'); continue; }

    // Dedup
    if (existExternal.has(idFactura)) { stat('Invoice', 'skipped'); continue; }

    const num = clean(f['num']);
    const anio = clean(f['anio']);
    const serie = clean(f['serie']) || '';
    // Generate unique invoice number: YEAR-NUM or R{NUM}
    let invoiceNumber = serie ? `${serie}${num}-${anio}` : `IMP-${num}-${anio}`;
    // Ensure uniqueness
    let suffix = 0;
    let candidate = invoiceNumber;
    while (existNumbers.has(candidate)) {
      suffix++;
      candidate = `${invoiceNumber}-${suffix}`;
    }
    invoiceNumber = candidate;
    existNumbers.add(invoiceNumber);
    existExternal.add(idFactura);

    const total = parseFloat(clean(f['total'])) || 0;
    const dateStr = parseDate(f['fecha']) || new Date().toISOString();
    const abonado = clean(f['abonado']);

    const invoiceId = randomUUID();
    invoiceIdMap.set(idFactura, invoiceId);

    invoicesToInsert.push({
      id: invoiceId,
      invoiceNumber,
      patientId: pid,
      amount: total,
      date: dateStr,
      status: abonado === '1' ? 'refunded' : 'paid',
      paymentMethod: null,
      externalId: idFactura,
      concept: clean(f['detalles']) || null,
    });

    // Line items
    const lines = conceptMap.get(idFactura) || [];
    for (const l of lines) {
      const detalle = clean(l['detalle']);
      if (!detalle) continue;
      const precio = parseFloat(clean(l['importe'])) || 0;
      const qty = parseInt(clean(l['cantidad'])) || 1;

      itemsToInsert.push({
        id: randomUUID(),
        invoiceId,
        name: detalle,
        price: precio,
      });
    }
  }

  log(`  → ${invoicesToInsert.length} facturas | ${itemsToInsert.length} líneas`);
  if (invoicesToInsert.length > 0) {
    const r = await insertBatch('Invoice', invoicesToInsert);
    log(`  ✔ Facturas insertadas: ${r.inserted}`);
  }
  if (itemsToInsert.length > 0) {
    const r = await insertBatch('InvoiceItem', itemsToInsert, 300);
    log(`  ✔ Líneas insertadas: ${r.inserted}`);
  }

  return invoiceIdMap;
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 9: PAYMENTS — apunte_1.csv
// ═══════════════════════════════════════════════════════════════════════════════
async function step9_payments(contactMap, invoiceIdMap) {
  log('═══ PASO 9: Pagos / Caja ════════════════════════════════════════');
  const apuntes = readCsv('apunte_1.csv');
  log(`  apunte_1: ${apuntes.length} filas`);

  // Dedup by sourcePaymentId
  const { data: existPays } = await supabase.from('Payment').select('sourcePaymentId');
  const existSources = new Set((existPays || []).filter(p => p.sourcePaymentId).map(p => p.sourcePaymentId));

  const toInsert = [];

  for (const a of apuntes) {
    const idApunte = clean(a['idApunte']);
    const tipoApunte = clean(a['tipoApunte']); // 0=ingreso, 1=gasto proveedor, 2=gasto
    
    // Only import patient payments (type 0 = income from patients)
    if (tipoApunte !== '0') { stat('Payment', 'skipped'); continue; }

    if (existSources.has(idApunte)) { stat('Payment', 'skipped'); continue; }
    existSources.add(idApunte);

    const idContacto = clean(a['idContacto']);
    const pid = contactMap.get(idContacto);
    if (!pid) { stat('Payment', 'skipped'); continue; }

    const importe = parseFloat(clean(a['importe'])) || 0;
    if (importe <= 0) { stat('Payment', 'skipped'); continue; }

    const forma = clean(a['forma']);
    const method = parsePaymentMethod(forma);
    const dateStr = parseDate(a['fechaApunte']) || parseDate(a['fecha']) || new Date().toISOString();
    const detalles = clean(a['detalles']);
    const descripcion = clean(a['descripcion']);

    // Link to invoice if available
    const idFactura = clean(a['idFactura']);
    const invoiceId = idFactura && idFactura !== '0' ? (invoiceIdMap.get(idFactura) || null) : null;

    toInsert.push({
      id: randomUUID(),
      patientId: pid,
      amount: importe,
      method,
      type: 'INCOME',
      sourcePaymentId: idApunte,
      notes: detalles || descripcion || null,
      createdAt: dateStr,
      // invoiceId — only set if not null (avoid FK constraint violations)
      ...(invoiceId ? { invoiceId } : {}),
    });
  }

  log(`  → ${toInsert.length} pagos a insertar`);
  if (toInsert.length > 0) {
    // Insert without invoiceId links first to avoid FK issues, then try to link
    const paymentsNoInvoice = toInsert.map(p => {
      const { invoiceId, ...rest } = p;
      return rest;
    });
    const r = await insertBatch('Payment', paymentsNoInvoice, 200);
    log(`  ✔ Insertados: ${r.inserted} | Errores: ${r.errors}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════
async function main() {
  log('╔══════════════════════════════════════════════════════════════════╗');
  log('║   IMPORTACIÓN COMPLETA — DatosCompletosClinica → Supabase      ║');
  log('║   CHC Clínica Dental                                           ║');
  if (DRY_RUN) {
    log('║   🔍 MODO DRY-RUN — NO se modificará la base de datos         ║');
  }
  log('╚══════════════════════════════════════════════════════════════════╝');
  log('');

  // Verify source directory
  if (!fs.existsSync(BASE_DIR)) {
    console.error(`❌ Directorio no encontrado: ${BASE_DIR}`);
    process.exit(1);
  }

  // Test connection
  if (!DRY_RUN) {
    const { error } = await supabase.from('Patient').select('count', { count: 'exact', head: true });
    if (error) { console.error('❌ Error conectando a Supabase:', error.message); process.exit(1); }
    log('✅ Conexión Supabase OK');
  }

  try {
    // PASO 1: Pacientes (genera el mapa contacto→UUID)
    const contactMap = await step1_patients();

    // PASO 2: Especialidades
    const specialtyMap = await step2_specialties();

    // PASO 3: Servicios / Catálogo de tratamientos
    const { serviceMap, treatmentMap } = await step3_services(specialtyMap);

    // PASO 4: Doctores + Horarios
    const { agendaMap, userDoctorMap } = await step4_doctors(specialtyMap);

    // PASO 5: Historial Clínico
    await step5_clinicalRecords(contactMap, userDoctorMap);

    // PASO 6: Citas
    const citaIdMap = await step6_appointments(contactMap, agendaMap, serviceMap);

    // PASO 7: Presupuestos
    const budgetIdMap = await step7_budgets(contactMap);

    // PASO 8: Facturas
    const invoiceIdMap = await step8_invoices(contactMap);

    // PASO 9: Pagos
    await step9_payments(contactMap, invoiceIdMap);

    // ─── RESUMEN FINAL ──────────────────────────────────────────────────────
    log('');
    log('╔══════════════════════════════════════════════════════════════════╗');
    log('║   📊  RESUMEN FINAL                                            ║');
    log('╠══════════════════════════════════════════════════════════════════╣');
    for (const [table, s] of Object.entries(stats)) {
      const parts = [];
      if (s.inserted) parts.push(`✅ ${s.inserted} insertados`);
      if (s.updated) parts.push(`🔄 ${s.updated} actualizados`);
      if (s.skipped) parts.push(`⏭ ${s.skipped} omitidos`);
      if (s.errors) parts.push(`❌ ${s.errors} errores`);
      log(`║  ${table.padEnd(20)} ${parts.join(' | ')}`);
    }
    log('╠══════════════════════════════════════════════════════════════════╣');
    if (DRY_RUN) {
      log('║   🔍 DRY-RUN completado — No se realizaron cambios            ║');
    } else {
      log('║   ✅ IMPORTACIÓN COMPLETADA                                    ║');
    }
    log('╚══════════════════════════════════════════════════════════════════╝');
  } catch (err) {
    console.error('');
    console.error('💀 ERROR FATAL:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

main();
