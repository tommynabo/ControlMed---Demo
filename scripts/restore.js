#!/usr/bin/env node

/**
 * restore.js — Bulk CSV Import Script
 * 
 * Reads CSV files from /assets and restores data into the Prisma/Supabase DB.
 * All old IDs are mapped to newly generated UUIDs.
 * 
 * Usage:  node scripts/restore.js
 * Flags:  --dry-run   Print what would be inserted without writing to DB
 */

const path = require('path');
const fs = require('fs');
const { parse } = require('csv-parse/sync');
const { PrismaClient } = require(require('path').resolve(__dirname, '..', 'server', 'node_modules', '@prisma', 'client'));
const crypto = require('crypto');
const iconv = require('iconv-lite');

// ─── Config ──────────────────────────────────────────────────────────────────
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
// Also try server/.env
if (!process.env.DATABASE_URL) {
    require('dotenv').config({ path: path.resolve(__dirname, '..', 'server', '.env') });
}

const DRY_RUN = process.argv.includes('--dry-run');
const ASSETS = path.resolve(__dirname, '..', 'assets');

const prisma = new PrismaClient({
    log: ['warn', 'error'],
});

// ─── ID Mapping Tables ──────────────────────────────────────────────────────
// oldId (from CSV) → newUUID
const maps = {
    users: new Map(),        // email → uuid
    doctors: new Map(),      // doctorName (normalised) → uuid
    patients: new Map(),     // IDCONTACTO → uuid
    specialties: new Map(),  // specialtyName → uuid
    services: new Map(),     // oldServiceId → uuid
    treatments: new Map(),   // oldServiceId → uuid (same as services for treatments)
    budgets: new Map(),      // budgetNumber → uuid
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function readCsv(filename, { separator = ';', encoding = 'utf-8' } = {}) {
    const filePath = path.join(ASSETS, filename);
    if (!fs.existsSync(filePath)) {
        console.warn(`⚠️  File not found: ${filename} — skipping`);
        return [];
    }

    let content;
    if (encoding === 'latin1' || encoding === 'iso-8859-1') {
        const buf = fs.readFileSync(filePath);
        content = iconv.decode(buf, 'iso-8859-1');
    } else {
        content = fs.readFileSync(filePath, 'utf-8');
    }

    // Handle BOM
    if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);

    return parse(content, {
        delimiter: separator,
        columns: true,
        skip_empty_lines: true,
        relax_column_count: true,
        trim: true,
        quote: '"',
    });
}

function normName(name) {
    if (!name) return '';
    return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function parseEurPrice(str) {
    if (!str) return 0;
    // "180,00 €" → 180.00
    return parseFloat(String(str).replace(/[€%\s]/g, '').replace(',', '.')) || 0;
}

function parseDate(dateStr) {
    if (!dateStr) return null;
    // Handle "DD/MM/YYYY", "DD-MM-YYYY HH:MM:SS", "YYYY-MM-DD"
    const s = dateStr.trim();

    // Already ISO
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
        const d = new Date(s);
        return isNaN(d.getTime()) ? null : d;
    }

    // DD/MM/YYYY or DD-MM-YYYY with optional time
    const match = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
    if (match) {
        const [, dd, mm, yyyy, hh, min, sec] = match;
        const d = new Date(
            parseInt(yyyy), parseInt(mm) - 1, parseInt(dd),
            parseInt(hh || 0), parseInt(min || 0), parseInt(sec || 0)
        );
        return isNaN(d.getTime()) ? null : d;
    }

    return null;
}

function safeIso(dateStr) {
    const d = parseDate(dateStr);
    return d ? d.toISOString() : new Date().toISOString();
}

function mapStatus(csvStatus) {
    const s = (csvStatus || '').toLowerCase().trim();
    if (s.includes('realizada') || s.includes('completada')) return 'Completed';
    if (s.includes('pendiente')) return 'Scheduled';
    if (s.includes('cancelada') || s.includes('anulada')) return 'Cancelled';
    if (s.includes('no asiste') || s.includes('no show')) return 'NoShow';
    return 'Scheduled';
}

function durationFromTimes(start, end) {
    if (!start || !end) return 30;
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    const diff = (eh * 60 + em) - (sh * 60 + sm);
    return diff > 0 ? diff : 30;
}

// ─── Step 1: Specialties ────────────────────────────────────────────────────
async function importSpecialties() {
    console.log('\n📂 1/8 — Importing Specialties...');

    // Collect unique specialties from multiple CSVs
    const specialtyNames = new Set();

    const especialidades = readCsv('especialidades.csv', { separator: ',' });
    for (const row of especialidades) {
        if (row.Especialidad) specialtyNames.add(row.Especialidad.trim());
    }

    const servicios = readCsv('listado_servicios_completo.csv');
    for (const row of servicios) {
        if (row.Especialidad) specialtyNames.add(row.Especialidad.trim());
    }

    let count = 0;
    for (const name of specialtyNames) {
        if (!name) continue;
        if (maps.specialties.has(name)) continue;

        if (!DRY_RUN) {
            const existing = await prisma.specialty.findUnique({ where: { name } });
            if (existing) {
                maps.specialties.set(name, existing.id);
                continue;
            }
            const created = await prisma.specialty.create({ data: { name } });
            maps.specialties.set(name, created.id);
        } else {
            maps.specialties.set(name, crypto.randomUUID());
        }
        count++;
    }
    console.log(`   ✅ ${count} specialties created (${specialtyNames.size} total unique)`);
}

// ─── Step 2: Users (Doctors + Admin/Reception) ─────────────────────────────
async function importUsers() {
    console.log('\n📂 2/8 — Importing Users...');

    const rows = readCsv('Listado_de_usuarios_avanzado.csv', { encoding: 'latin1' });
    let count = 0;

    for (const row of rows) {
        const email = (row.USUARIO || '').trim().toLowerCase();
        const name = (row.NOMBRE || '').trim();
        const rolRaw = (row.ROL || '').trim().toLowerCase();
        const estado = (row.ESTADO || '').trim().toLowerCase();
        if (!email || !name) continue;

        // Determine role
        let role = 'DOCTOR';
        if (rolRaw.includes('admin') || rolRaw.includes('administrador')) role = 'ADMIN';
        else if (rolRaw.includes('usuario') || rolRaw.includes('recep')) role = 'RECEPTION';

        const isActive = estado === 'alta';

        if (maps.users.has(email)) continue;

        if (!DRY_RUN) {
            const existing = await prisma.user.findUnique({ where: { email } });
            if (existing) {
                maps.users.set(email, existing.id);
                // Also map doctor name for appointment linking
                maps.doctors.set(normName(name), existing.doctorId || existing.id);
                continue;
            }

            const sharedId = crypto.randomUUID();
            const user = await prisma.user.create({
                data: {
                    id: sharedId,
                    email,
                    name,
                    password: '123456',
                    role,
                    isActive,
                }
            });

            maps.users.set(email, user.id);

            // If doctor, create Doctor + DoctorSchedule
            if (role === 'DOCTOR') {
                // Determine specialty from especialidades.csv
                const especialidades = readCsv('especialidades.csv', { separator: ',' });
                const userSpecialties = especialidades
                    .filter(e => normName(e.Usuario) === normName(name))
                    .map(e => e.Especialidad?.trim())
                    .filter(Boolean);
                const mainSpecialty = userSpecialties[0] || 'Odontología';
                const specId = maps.specialties.get(mainSpecialty) || null;

                await prisma.doctor.create({
                    data: {
                        id: sharedId,
                        name,
                        specialization: mainSpecialty,
                        specialtyId: specId,
                        commissionPercentage: 0,
                    }
                });

                await prisma.user.update({
                    where: { id: sharedId },
                    data: { doctorId: sharedId }
                });

                await prisma.doctorSchedule.create({
                    data: {
                        doctorId: sharedId,
                        doctorName: name,
                        monday: true, tuesday: true, wednesday: true,
                        thursday: true, friday: true, saturday: false, sunday: false,
                        morningStart: '09:00:00', morningEnd: '13:00:00',
                        afternoonStart: '16:00:00', afternoonEnd: '20:00:00',
                    }
                });

                maps.doctors.set(normName(name), sharedId);
            }
        } else {
            const id = crypto.randomUUID();
            maps.users.set(email, id);
            maps.doctors.set(normName(name), id);
        }
        count++;
    }
    console.log(`   ✅ ${count} users imported`);
}

// ─── Step 3: Patients ───────────────────────────────────────────────────────
async function importPatients() {
    console.log('\n📂 3/8 — Importing Patients...');

    const rows = readCsv('patients.csv');
    let count = 0;
    let skipped = 0;

    for (const row of rows) {
        const idContacto = (row.IDCONTACTO || '').trim();
        const nombre = (row.NOMBRE || '').trim();
        const apellidos = (row.APELLIDOS || '').trim();
        const dni = (row.DNI || '').trim();
        const email = (row.EMAIL || '').trim();
        const phone = (row['TELF. MOVIL'] || row['TELF. FIJO'] || '').trim();
        const birthDateStr = (row['F. NACIMIENTO'] || '').trim();
        const estado = (row.ESTADO || '').trim();
        const numHistoria = (row.NUM || '').trim();
        const sexo = (row.SEXO || '').trim();
        const insurance = (row.MUTUA || '').trim();
        const notas = (row.NOTAS || '').trim();
        const patologia = (row['PATOLOGÍA'] || row.PATOLOGIA || '').trim();
        const usuario = (row.USUARIO || '').trim();

        // Skip inactive or test rows
        if (!nombre || estado.toLowerCase() === 'baja') {
            skipped++;
            continue;
        }

        // Build name parts
        const firstName = nombre;
        const apellidoParts = apellidos.split(/\s+/);
        const lastName1 = apellidoParts[0] || '';
        const lastName2 = apellidoParts.slice(1).join(' ') || '';
        const fullName = `${firstName} ${apellidos}`.trim();

        // Parse birthdate — fallback to a reasonable default
        const birthDate = parseDate(birthDateStr) || new Date('2000-01-01');

        // Generate unique DNI if missing to satisfy unique constraint
        const safeDni = dni || `SIN-DNI-${idContacto || crypto.randomUUID().slice(0, 8)}`;

        // History number
        const historyNumber = numHistoria ? `HC-${String(numHistoria).padStart(4, '0')}` : null;

        // Assigned doctor
        const doctorEmail = (usuario || '').trim().toLowerCase();
        const assignedDoctorId = maps.users.has(doctorEmail) ? maps.doctors.get(normName('')) : null;
        // Try to find doctor by user email
        let assignedDocId = null;
        if (doctorEmail && maps.users.has(doctorEmail)) {
            // The user might be a doctor — get their doctor ID
            const userId = maps.users.get(doctorEmail);
            // Check if this userId is also in doctors map
            for (const [dname, did] of maps.doctors.entries()) {
                if (did === userId) { assignedDocId = did; break; }
            }
        }

        if (maps.patients.has(idContacto)) continue;

        if (!DRY_RUN) {
            try {
                // Check for existing patient by DNI
                const existing = await prisma.patient.findFirst({
                    where: { OR: [
                        { dni: safeDni },
                        ...(historyNumber ? [{ historyNumber }] : [])
                    ]}
                });
                if (existing) {
                    maps.patients.set(idContacto, existing.id);
                    continue;
                }

                const patient = await prisma.patient.create({
                    data: {
                        name: fullName,
                        firstName,
                        lastName1,
                        lastName2: lastName2 || null,
                        dni: safeDni,
                        email: email || '',
                        phone: phone || null,
                        birthDate: birthDate.toISOString(),
                        insurance: insurance || null,
                        historyNumber,
                        assignedDoctorId: assignedDocId,
                        allergies: null,
                        smoker: false,
                        diseases: patologia || null,
                        medications: null,
                        criticalAlerts: notas ? JSON.stringify([notas]) : null,
                    }
                });
                maps.patients.set(idContacto, patient.id);
                count++;
            } catch (err) {
                console.warn(`   ⚠️  Patient "${fullName}" (${safeDni}) failed: ${err.message}`);
                skipped++;
            }
        } else {
            maps.patients.set(idContacto, crypto.randomUUID());
            count++;
        }
    }
    console.log(`   ✅ ${count} patients imported, ${skipped} skipped`);
}

// ─── Step 4: Services & Treatments Catalog ──────────────────────────────────
async function importServices() {
    console.log('\n📂 4/8 — Importing Services Catalog...');

    const rows = readCsv('listado_servicios_completo.csv');
    let count = 0;

    for (const row of rows) {
        const oldId = (row['ID Servicio'] || '').trim();
        const name = (row.Servicio || '').trim();
        const specName = (row.Especialidad || '').trim();
        const specColor = (row['Especialidad color'] || '#888888').trim();
        const price = parseEurPrice(row.Importe || row.Base);
        const estado = (row.Estado || '').trim().toLowerCase();
        const isActive = estado !== 'inactivo';

        if (!name) continue;
        if (maps.services.has(oldId)) continue;

        if (!DRY_RUN) {
            try {
                const service = await prisma.service.create({
                    data: {
                        name,
                        specialty_name: specName || null,
                        specialty_color: specColor,
                        final_price: price,
                        is_active: isActive,
                    }
                });
                maps.services.set(oldId, service.id);

                // Also create a Treatment record for appointment linking
                const specId = maps.specialties.get(specName) || null;
                const treatment = await prisma.treatment.create({
                    data: {
                        name,
                        price,
                        labCost: 0,
                        specialtyId: specId,
                    }
                });
                maps.treatments.set(oldId, treatment.id);
                count++;
            } catch (err) {
                console.warn(`   ⚠️  Service "${name}" failed: ${err.message}`);
            }
        } else {
            maps.services.set(oldId, crypto.randomUUID());
            maps.treatments.set(oldId, crypto.randomUUID());
            count++;
        }
    }
    console.log(`   ✅ ${count} services/treatments imported`);
}

// ─── Step 5: Appointments (Citas) ───────────────────────────────────────────
async function importAppointments() {
    console.log('\n📂 5/8 — Importing Appointments...');

    const rows = readCsv('citas.csv');
    let count = 0;
    let skipped = 0;

    for (const row of rows) {
        const fecha = (row.FECHA || '').trim();
        const horaInicio = (row['HORA INICIO'] || '').trim();
        const horaFin = (row['HORA FIN'] || '').trim();
        const estado = (row.ESTADO || '').trim();
        const asunto = (row.ASUNTO || '').trim();
        const detalles = (row.DETALLES || '').trim();
        const serviceName = (row.SERVICIOS || '').trim();
        const agenda = (row.AGENDA || '').trim();       // Doctor name
        const usuario = (row.USUARIO || '').trim();      // Acting user
        const idContacto = (row.IDCONTACTO || '').trim();
        const importeCita = parseFloat((row['IMPORTE CITA'] || '0').replace(',', '.')) || 0;

        if (!fecha || !idContacto) { skipped++; continue; }

        // Resolve patient
        const patientId = maps.patients.get(idContacto);
        if (!patientId) {
            skipped++;
            continue;
        }

        // Resolve doctor by agenda name
        let doctorId = null;
        if (agenda) {
            // Try to find the doctor by normalized name
            const normAgenda = normName(agenda);
            for (const [dname, did] of maps.doctors.entries()) {
                if (normAgenda.includes(dname) || dname.includes(normAgenda)) {
                    doctorId = did;
                    break;
                }
            }
            // Fallback: try partial match
            if (!doctorId) {
                const agendaParts = normAgenda.replace(/^dr\.?\s*/i, '').trim();
                for (const [dname, did] of maps.doctors.entries()) {
                    if (dname.includes(agendaParts) || agendaParts.includes(dname.replace(/^dr\.?\s*/i, ''))) {
                        doctorId = did;
                        break;
                    }
                }
            }
        }

        // If still no doctor, try to use user email
        if (!doctorId && usuario) {
            const uEmail = usuario.toLowerCase().trim();
            const uId = maps.users.get(uEmail);
            if (uId) {
                for (const [, did] of maps.doctors.entries()) {
                    if (did === uId) { doctorId = did; break; }
                }
            }
        }

        if (!doctorId) { skipped++; continue; }

        const dateObj = parseDate(fecha);
        if (!dateObj) { skipped++; continue; }

        const duration = durationFromTimes(horaInicio, horaFin);

        if (!DRY_RUN) {
            try {
                await prisma.appointment.create({
                    data: {
                        date: dateObj.toISOString(),
                        time: horaInicio || '09:00:00',
                        duration,
                        observations: detalles || asunto || null,
                        status: mapStatus(estado),
                        paid: false,
                        patientId,
                        doctorId,
                        treatmentName: serviceName || null,
                        amount: importeCita || null,
                    }
                });
                count++;
            } catch (err) {
                console.warn(`   ⚠️  Appointment ${fecha} for patient ${idContacto} failed: ${err.message}`);
                skipped++;
            }
        } else {
            count++;
        }
    }
    console.log(`   ✅ ${count} appointments imported, ${skipped} skipped`);
}

// ─── Step 6: Clinical Records (Historiales + Seguimientos) ──────────────────
async function importClinicalRecords() {
    console.log('\n📂 6/8 — Importing Clinical Records...');

    let count = 0;
    let skipped = 0;

    // 6a: historiales.csv
    const historiales = readCsv('historiales.csv');
    for (const row of historiales) {
        const idContacto = (row.IDCONTACTO || '').trim();
        const fecha = (row.FECHA || '').trim();
        const historial = (row.HISTORIAL || '').trim();
        const evolucion = (row.EVOLUCION || '').trim();
        const usuario = (row.USUARIO || '').trim();

        const patientId = maps.patients.get(idContacto);
        if (!patientId) { skipped++; continue; }

        const text = [historial, evolucion].filter(Boolean).join('\n\n');
        if (!text.trim()) { skipped++; continue; }

        const authorId = usuario ? (maps.users.get(usuario.toLowerCase().trim()) || null) : null;

        if (!DRY_RUN) {
            try {
                await prisma.clinicalRecord.create({
                    data: {
                        patientId,
                        date: safeIso(fecha),
                        text,
                        authorId,
                    }
                });
                count++;
            } catch (err) {
                console.warn(`   ⚠️  Clinical record for ${idContacto} failed: ${err.message}`);
                skipped++;
            }
        } else { count++; }
    }

    // 6b: seguimientos.csv
    const seguimientos = readCsv('seguimientos.csv');
    for (const row of seguimientos) {
        const idContacto = (row.IDCONTACTO || '').trim();
        const fecha = (row.FECHA || '').trim();
        const historial = (row.HISTORIAL || '').trim();
        const detalles = (row.DETALLES || '').trim();
        const usuario = (row.USUARIO || '').trim();

        const patientId = maps.patients.get(idContacto);
        if (!patientId) { skipped++; continue; }

        const text = [historial, detalles].filter(Boolean).join('\n\n');
        if (!text.trim()) { skipped++; continue; }

        const authorId = usuario ? (maps.users.get(usuario.toLowerCase().trim()) || null) : null;

        if (!DRY_RUN) {
            try {
                await prisma.clinicalRecord.create({
                    data: {
                        patientId,
                        date: safeIso(fecha),
                        text,
                        authorId,
                    }
                });
                count++;
            } catch (err) {
                console.warn(`   ⚠️  Seguimiento for ${idContacto} failed: ${err.message}`);
                skipped++;
            }
        } else { count++; }
    }

    console.log(`   ✅ ${count} clinical records imported, ${skipped} skipped`);
}

// ─── Step 7: Budgets (Presupuestos) ─────────────────────────────────────────
async function importBudgets() {
    console.log('\n📂 7/8 — Importing Budgets...');

    const rows = readCsv('presupuestos.csv');
    let budgetCount = 0;
    let itemCount = 0;
    let skipped = 0;

    // Group rows by NÚMERO (budget number) since each row is a line item
    const grouped = new Map();
    for (const row of rows) {
        const num = (row['NÚMERO'] || row.NUMERO || '').trim();
        if (!num) continue;
        if (!grouped.has(num)) grouped.set(num, []);
        grouped.get(num).push(row);
    }

    for (const [budgetNum, items] of grouped.entries()) {
        const first = items[0];
        const idContacto = (first.IDCONTACTO || '').trim();
        const patientId = maps.patients.get(idContacto);
        if (!patientId) { skipped++; continue; }

        const fecha = (first.FECHA || '').trim();
        const totalStr = (first['TOTAL PRESUPUESTO'] || '0').replace(',', '.');
        const total = parseFloat(totalStr) || 0;
        const aceptado = (first.ACEPTADO || '').toLowerCase().trim();
        const status = aceptado === 'sí' || aceptado === 'si' ? 'ACCEPTED' : 'DRAFT';
        const title = `Presupuesto #${budgetNum}`;

        if (!DRY_RUN) {
            try {
                const budget = await prisma.budget.create({
                    data: {
                        patientId,
                        title,
                        date: safeIso(fecha),
                        status,
                        totalAmount: total,
                    }
                });
                maps.budgets.set(budgetNum, budget.id);
                budgetCount++;

                // Create line items
                for (const item of items) {
                    const concepto = (item.CONCEPTO || '').trim();
                    const servicio = (item['SERVICIO/PRODUCTO'] || '').trim();
                    const itemName = concepto || servicio || 'Concepto';
                    const cantidad = parseInt(item.CANTIDAD || '1') || 1;
                    const totalConcepto = parseFloat((item['TOTAL CONCEPTO'] || '0').replace(',', '.')) || 0;
                    const pieza = (item.PIEZA || '').trim();
                    const identificador = (item.IDENTIFICADOR || '').trim();

                    // Try to link to treatment
                    const treatmentId = maps.treatments.get(identificador) || null;

                    await prisma.budgetLineItem.create({
                        data: {
                            budgetId: budget.id,
                            name: itemName,
                            price: totalConcepto / cantidad || 0,
                            quantity: cantidad,
                            tooth: pieza || null,
                            treatmentId,
                        }
                    });
                    itemCount++;
                }
            } catch (err) {
                console.warn(`   ⚠️  Budget #${budgetNum} failed: ${err.message}`);
                skipped++;
            }
        } else {
            maps.budgets.set(budgetNum, crypto.randomUUID());
            budgetCount++;
            itemCount += items.length;
        }
    }
    console.log(`   ✅ ${budgetCount} budgets, ${itemCount} line items imported, ${skipped} skipped`);
}

// ─── Step 8: Invoices (Facturas) ────────────────────────────────────────────
async function importInvoices() {
    console.log('\n📂 8/8 — Importing Invoices...');

    const rows = readCsv('facturas.csv');
    let count = 0;
    let skipped = 0;

    // Group by NUMERO (invoice number) since each row can be a line item
    const grouped = new Map();
    for (const row of rows) {
        const num = (row.NUMERO || '').trim();
        if (!num) continue;
        if (!grouped.has(num)) grouped.set(num, []);
        grouped.get(num).push(row);
    }

    for (const [invoiceNum, items] of grouped.entries()) {
        const first = items[0];
        const idContacto = (first.IDCONTACTO || '').trim();
        const patientId = maps.patients.get(idContacto);
        if (!patientId) { skipped++; continue; }

        const fecha = (first.FECHA || '').trim();
        // Sum amounts across all line items for this invoice
        const totalAmount = items.reduce((sum, item) => {
            return sum + (parseFloat((item.IMPORTE || '0').replace(',', '.')) || 0);
        }, 0);

        if (!DRY_RUN) {
            try {
                const invoice = await prisma.invoice.create({
                    data: {
                        invoiceNumber: invoiceNum,
                        patientId,
                        amount: totalAmount,
                        date: safeIso(fecha),
                        status: 'PAID',
                        concept: items.map(i => (i.DETALLES || '').trim()).filter(Boolean).join('; '),
                    }
                });

                // Create line items
                for (const item of items) {
                    const name = (item.DETALLES || item.SERVICIO || '').trim() || 'Concepto';
                    const price = parseFloat((item.IMPORTE || '0').replace(',', '.')) || 0;
                    await prisma.invoiceItem.create({
                        data: {
                            invoiceId: invoice.id,
                            name,
                            price,
                        }
                    });
                }
                count++;
            } catch (err) {
                // Duplicate invoice number — skip
                if (err.code === 'P2002') {
                    skipped++;
                } else {
                    console.warn(`   ⚠️  Invoice ${invoiceNum} failed: ${err.message}`);
                    skipped++;
                }
            }
        } else {
            count++;
        }
    }
    console.log(`   ✅ ${count} invoices imported, ${skipped} skipped`);
}

// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
    console.log('═══════════════════════════════════════════════════');
    console.log('  CRM Médico — CSV Bulk Restore Script');
    console.log(`  Mode: ${DRY_RUN ? '🔍 DRY RUN (no writes)' : '💾 LIVE (writing to DB)'}`);
    console.log(`  Assets: ${ASSETS}`);
    console.log('═══════════════════════════════════════════════════');

    // Verify connection
    try {
        await prisma.$connect();
        console.log('✅ Database connected');
    } catch (err) {
        console.error('❌ Cannot connect to database:', err.message);
        process.exit(1);
    }

    // Verify assets directory
    if (!fs.existsSync(ASSETS)) {
        console.error(`❌ Assets directory not found: ${ASSETS}`);
        process.exit(1);
    }

    try {
        // Import in FK-safe order
        await importSpecialties();
        await importUsers();
        await importPatients();
        await importServices();
        await importAppointments();
        await importClinicalRecords();
        await importBudgets();
        await importInvoices();

        console.log('\n═══════════════════════════════════════════════════');
        console.log('  ✅ RESTORE COMPLETE');
        console.log(`  Mappings: ${maps.users.size} users, ${maps.doctors.size} doctors, ${maps.patients.size} patients`);
        console.log(`  ${maps.specialties.size} specialties, ${maps.services.size} services, ${maps.budgets.size} budgets`);
        console.log('═══════════════════════════════════════════════════');
    } catch (err) {
        console.error('\n❌ FATAL ERROR:', err.message);
        console.error(err.stack);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
