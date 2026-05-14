#!/usr/bin/env node
/**
 * Fix: crear liquidaciones faltantes de la Dra. Abigail — Abril 2026.
 *
 * Pacientes afectados:
 *   20/04 — Enrique Martínez    — Tartrectomia              — 60 €
 *   20/04 — Ma José Moreno      — Tartrectomia              — 60 €
 *   21/04 — Eduardo Dimas       — Obturación simple p.2.1   — 60 €
 *   21/04 — Paulo De Castro     — Obturación clase II D17   — 80 €
 *
 * USO:
 *   1. Ejecuta primero el diagnóstico:
 *        node fix_abigail_abril_liquidaciones.js --diagnose
 *      Revisa el output y confirma que los IDs y cifras son correctos.
 *
 *   2. Ejecuta el modo dry-run (por defecto, sin --apply):
 *        node fix_abigail_abril_liquidaciones.js
 *
 *   3. Si todo se ve bien, aplica los cambios:
 *        node fix_abigail_abril_liquidaciones.js --apply
 *
 * El script es IDEMPOTENTE: si ya existe una liquidación para una cita,
 * la muestra y no crea ninguna duplicada.
 */

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const APPLY    = process.argv.includes('--apply');
const DIAGNOSE = process.argv.includes('--diagnose');

// ── Pacientes a corregir ──────────────────────────────────────────────────────
// La búsqueda se hace por nombre de paciente + fecha de cita.
// El tratamiento y el importe se usan para mostrar el diagnóstico y
// como valor de grossAmount si el campo amount de la cita está vacío.
const PATIENTS_TO_FIX = [
    {
        patientNameSearch: '%enrique%martin%',
        patientDisplayName: 'Enrique Martínez',
        date: '2026-04-20',
        treatmentName: 'Tartrectomia',
        expectedAmount: 60,
        paymentMethod: 'cash',        // ajustar si fue diferente
    },
    {
        patientNameSearch: '%jose%moreno%',
        patientDisplayName: 'Ma José Moreno',
        date: '2026-04-20',
        treatmentName: 'Tartrectomia',
        expectedAmount: 60,
        paymentMethod: 'cash',
    },
    {
        patientNameSearch: '%eduardo%dimas%',
        patientDisplayName: 'Eduardo Dimas',
        date: '2026-04-21',
        treatmentName: 'Obturación simple pieza 2.1',
        expectedAmount: 60,
        paymentMethod: 'cash',
    },
    {
        patientNameSearch: '%paulo%castro%',
        patientDisplayName: 'Paulo De Castro',
        date: '2026-04-21',
        treatmentName: 'Obturación Clase II D17',
        expectedAmount: 80,
        paymentMethod: 'cash',
    },
];

// ─────────────────────────────────────────────────────────────────────────────

async function getAbigailDoctor() {
    const { data, error } = await supabase
        .from('Doctor')
        .select('id, name, commissionPercentage')
        .ilike('name', '%abigail%');
    if (error) throw new Error('Error buscando doctor Abigail: ' + error.message);
    if (!data || data.length === 0) throw new Error('No se encontró ningún doctor con nombre "abigail". Revisa el nombre en la tabla Doctor.');
    if (data.length > 1) {
        console.warn('⚠️  Múltiples doctores encontrados con "abigail":');
        data.forEach(d => console.warn(`   ${d.id} — ${d.name}`));
        console.warn('   Se usará el primero. Edita ABIGAIL_DOCTOR_ID en el script si es incorrecto.');
    }
    return data[0];
}

async function findAppointment(doctorId, patientNameSearch, date) {
    // Find patient first
    const { data: patients } = await supabase
        .from('Patient')
        .select('id, name')
        .ilike('name', patientNameSearch);

    if (!patients || patients.length === 0) return { appointment: null, patient: null };

    for (const patient of patients) {
        const { data: appts } = await supabase
            .from('Appointment')
            .select('id, date, amount, treatmentName, status, paid, doctorId')
            .eq('patientId', patient.id)
            .eq('date', date)
            .is('deleted_at', null)
            .order('date', { ascending: false });

        if (appts && appts.length > 0) {
            // Prefer appointment assigned to Abigail; fallback to first
            const best = appts.find(a => a.doctorId === doctorId) || appts[0];
            return { appointment: best, patient };
        }
    }
    return { appointment: null, patient: null };
}

async function findPayment(appointmentId) {
    if (!appointmentId) return null;
    const { data } = await supabase
        .from('Payment')
        .select('id, amount, method, type, createdAt')
        .eq('appointmentId', appointmentId)
        .neq('type', 'ADVANCE_PAYMENT')
        .order('createdAt', { ascending: false })
        .limit(1)
        .maybeSingle();
    return data;
}

async function checkExistingLiquidation(appointmentId, doctorId) {
    const { data } = await supabase
        .from('Liquidation')
        .select('id, grossAmount, finalAmount, treatmentName, status, createdAt')
        .eq('appointmentId', appointmentId)
        .eq('doctorId', doctorId);
    return data || [];
}

async function processPatient(abigailDoctor, entry, applyMode) {
    console.log(`\n──────────────────────────────────────────────────`);
    console.log(`  Paciente: ${entry.patientDisplayName} — ${entry.date}`);
    console.log(`──────────────────────────────────────────────────`);

    // 1. Find appointment
    const { appointment, patient } = await findAppointment(
        abigailDoctor.id,
        entry.patientNameSearch,
        entry.date
    );

    if (!appointment) {
        console.log(`  ❌ No se encontró cita para "${entry.patientDisplayName}" el ${entry.date}.`);
        console.log(`     Verifica el nombre del paciente en la base de datos.`);
        return { status: 'NOT_FOUND' };
    }

    console.log(`  ✅ Cita encontrada:     ${appointment.id}`);
    console.log(`     Paciente DB:         ${patient.name}`);
    console.log(`     Estado cita:         ${appointment.status}`);
    console.log(`     Pagada:              ${appointment.paid}`);
    console.log(`     Tratamiento:         ${appointment.treatmentName || '(vacío)'}`);
    console.log(`     Importe en cita:     ${appointment.amount ?? '(nulo)'}€`);
    console.log(`     Doctor en cita:      ${appointment.doctorId}`);

    if (appointment.doctorId && appointment.doctorId !== abigailDoctor.id) {
        console.log(`  ⚠️  La cita tiene otro doctor asignado (${appointment.doctorId}).`);
        console.log(`     Se creará la liquidación con el doctor de la cita, no con Abigail.`);
        console.log(`     Si esto es incorrecto, corrige el doctorId de la cita primero.`);
    }

    // 2. Check existing liquidation
    const doctorIdToUse = appointment.doctorId || abigailDoctor.id;
    const existing = await checkExistingLiquidation(appointment.id, doctorIdToUse);
    if (existing.length > 0) {
        console.log(`  ℹ️  Ya existe liquidación — no se crea ninguna nueva:`);
        existing.forEach(l =>
            console.log(`     ID: ${l.id} | ${l.treatmentName} | ${l.grossAmount}€ | ${l.status} | ${l.createdAt}`)
        );
        return { status: 'ALREADY_EXISTS' };
    }

    // 3. Find payment
    const payment = await findPayment(appointment.id);
    if (!payment) {
        console.log(`  ⚠️  No hay Payment registrado para esta cita.`);
        console.log(`     Se creará la liquidación SIN paymentId (menos trazabilidad).`);
    } else {
        console.log(`  ✅ Pago encontrado:     ${payment.id}`);
        console.log(`     Importe pago:        ${payment.amount}€`);
        console.log(`     Método:              ${payment.method}`);
    }

    // 4. Resolve amounts
    const grossAmount = payment
        ? parseFloat(payment.amount)
        : (appointment.amount ? parseFloat(appointment.amount) : entry.expectedAmount);

    const commissionPct   = abigailDoctor.commissionPercentage || 30;
    const finalAmount     = grossAmount * (commissionPct / 100);
    const treatmentName   = entry.treatmentName || appointment.treatmentName || 'Tratamiento';
    const paymentMethod   = payment?.method || entry.paymentMethod || 'cash';
    // Use appointment date (noon UTC) so it falls in the correct month's report
    const createdAt       = `${entry.date}T12:00:00.000Z`;
    const liquidationId   = crypto.randomUUID();

    console.log(`\n  📋 Liquidación a crear:`);
    console.log(`     ID:             ${liquidationId}`);
    console.log(`     Doctor:         ${abigailDoctor.name} (${doctorIdToUse})`);
    console.log(`     Appointment:    ${appointment.id}`);
    console.log(`     Payment:        ${payment?.id || '(ninguno)'}`);
    console.log(`     Tratamiento:    ${treatmentName}`);
    console.log(`     Bruto:          ${grossAmount}€`);
    console.log(`     Comisión:       ${commissionPct}%  →  ${finalAmount.toFixed(2)}€`);
    console.log(`     Método:         ${paymentMethod}`);
    console.log(`     createdAt:      ${createdAt}`);

    if (!applyMode) {
        console.log(`\n  🟡 DRY-RUN — no se ha guardado nada.`);
        return { status: 'DRY_RUN' };
    }

    // 5. Insert
    const { data: liq, error } = await supabase
        .from('Liquidation')
        .insert({
            id: liquidationId,
            doctorId: doctorIdToUse,
            appointmentId: appointment.id,
            paymentId: payment?.id || null,
            itemIndex: null,
            grossAmount,
            baseAmount: grossAmount,
            labCost: 0,
            commissionRate: commissionPct,
            finalAmount,
            referralCommission: 0,
            referralEntityName: null,
            treatmentName,
            patientName: patient.name,
            paymentMethod,
            status: 'PENDING',
            createdAt,
        })
        .select()
        .single();

    if (error) {
        console.error(`  ❌ Error al insertar: ${error.message}`);
        return { status: 'ERROR', error: error.message };
    }

    console.log(`  ✅ Liquidación creada: ${liq.id}`);
    return { status: 'CREATED', id: liq.id };
}

async function main() {
    console.log('══════════════════════════════════════════════════════════');
    console.log(`  FIX LIQUIDACIONES ABIGAIL — ABRIL 2026`);
    console.log(`  Modo: ${APPLY ? '🔴 APLICAR' : '🟡 DRY-RUN'}${DIAGNOSE ? ' + DIAGNOSE' : ''}`);
    console.log('══════════════════════════════════════════════════════════\n');

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.error('❌ Variables de entorno faltantes: SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY');
        console.error('   Asegúrate de que existe el archivo .env con esas claves en la raíz del proyecto.');
        process.exit(1);
    }

    // Find Abigail
    let abigailDoctor;
    try {
        abigailDoctor = await getAbigailDoctor();
    } catch (e) {
        console.error('❌', e.message);
        process.exit(1);
    }
    console.log(`✅ Doctor encontrado: ${abigailDoctor.name} (id: ${abigailDoctor.id}, comisión: ${abigailDoctor.commissionPercentage}%)\n`);

    if (DIAGNOSE) {
        // Extra: show ALL of Abigail's April appointments without liquidation
        console.log('═══ DIAGNÓSTICO COMPLETO: Citas de Abigail en Abril sin liquidación ═══\n');
        const { data: appts } = await supabase
            .from('Appointment')
            .select('id, date, amount, treatmentName, status, paid, patient:Patient(name)')
            .eq('doctorId', abigailDoctor.id)
            .gte('date', '2026-04-01')
            .lte('date', '2026-04-30')
            .is('deleted_at', null)
            .order('date');

        if (!appts || appts.length === 0) {
            console.log('  No se encontraron citas de Abigail en abril.');
        } else {
            const apptIds = appts.map(a => a.id);
            const { data: existingLiqs } = await supabase
                .from('Liquidation')
                .select('appointmentId')
                .in('appointmentId', apptIds);
            const coveredIds = new Set((existingLiqs || []).map(l => l.appointmentId));

            console.log(`  Total citas en abril: ${appts.length}`);
            console.log(`  Con liquidación:      ${coveredIds.size}`);
            console.log(`  SIN liquidación:      ${appts.length - coveredIds.size}\n`);

            const missing = appts.filter(a => !coveredIds.has(a.id));
            if (missing.length === 0) {
                console.log('  ✅ Todas las citas tienen liquidación.');
            } else {
                console.log('  Citas SIN liquidación:');
                missing.forEach(a =>
                    console.log(`    ${a.date}  ${(a.patient?.name || '?').padEnd(25)}  ${String(a.amount ?? '?').padStart(5)}€  [${a.status}]  ${a.treatmentName || ''}`)
                );
            }
        }
        console.log('');
    }

    // Process each patient
    const results = { CREATED: 0, ALREADY_EXISTS: 0, NOT_FOUND: 0, DRY_RUN: 0, ERROR: 0 };
    for (const entry of PATIENTS_TO_FIX) {
        const result = await processPatient(abigailDoctor, entry, APPLY);
        results[result.status] = (results[result.status] || 0) + 1;
    }

    console.log('\n══════════════════════════════════════════════════════════');
    console.log('  RESUMEN');
    console.log('══════════════════════════════════════════════════════════');
    if (APPLY) {
        console.log(`  ✅ Creadas:            ${results.CREATED}`);
        console.log(`  ℹ️  Ya existían:        ${results.ALREADY_EXISTS}`);
        console.log(`  ❌ No encontradas:     ${results.NOT_FOUND}`);
        console.log(`  ❌ Errores:            ${results.ERROR}`);
        if (results.CREATED > 0) {
            console.log('\n  Verifica en el CRM: Liquidaciones → Dra. Abigail → Abril 2026');
        }
    } else {
        console.log(`  🟡 DRY-RUN completado. Ejecuta con --apply para guardar los cambios.`);
        console.log(`  ℹ️  Ya existían:        ${results.ALREADY_EXISTS}`);
        console.log(`  ❌ No encontradas:     ${results.NOT_FOUND}`);
    }
    console.log('');
}

main().catch(err => {
    console.error('\n❌ Error fatal:', err.message);
    process.exit(1);
});
