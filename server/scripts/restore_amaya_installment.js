#!/usr/bin/env node
/**
 * ============================================================
 * RESTAURACIÓN: Segundo plazo de Amaya — Blanqueamiento Domiciliario
 * ============================================================
 *
 * Contexto:
 *   - El blanqueamiento domiciliario de AMAYA costaba 350€ (2 plazos de 175€).
 *   - El primer plazo (17/04/2026, ~175€) está correcto en BD.
 *   - El segundo plazo (20/04/2026, ~175€) fue borrado por error con
 *     fix-amaya-duplicate-invoice.js y fix-amaya-duplicate-payment.js.
 *   - Además, ninguno de los dos plazos creó Liquidación (bug corregido en el código).
 *
 * Este script:
 *   1. Verifica el estado actual (facturas + pagos + liquidación) de Amaya.
 *   2. Si falta el segundo pago, lo crea (Payment + Invoice + InvoiceItem).
 *   3. Si falta la Liquidación del doctor para este tratamiento, la crea.
 *   4. Marca la cita como Completed/paid=true si no lo está.
 *
 * Ejecutar: node scripts/restore_amaya_installment.js
 * ============================================================
 */

const { createClient } = require('@supabase/supabase-js');
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const prisma = new PrismaClient();

// ── Config ────────────────────────────────────────────────────────────────────
const TREATMENT_NAME_CONTAINS = 'Blanqueamiento';
const FULL_TREATMENT_AMOUNT   = 350;   // total cost of the treatment
const INSTALMENT_AMOUNT       = 175;   // each instalment
const PAYMENT_DATE_RESTORED   = '2026-04-20T13:29:00.000Z'; // approximate original date

async function main() {
    console.log('═══════════════════════════════════════════════════');
    console.log('  RESTAURACIÓN AMAYA — Segundo Plazo Blanqueamiento');
    console.log('═══════════════════════════════════════════════════\n');

    // 1. Find patient Amaya
    const { data: patients, error: pErr } = await supabase
        .from('Patient')
        .select('id, name, wallet')
        .ilike('name', '%amaya%');

    if (pErr || !patients?.length) {
        console.error('❌ No se encontró paciente Amaya:', pErr?.message);
        process.exit(1);
    }

    if (patients.length > 1) {
        console.log('ℹ️  Múltiples coincidencias para "amaya":');
        patients.forEach((p, i) => console.log(`   ${i + 1}. ${p.name} (${p.id})`));
    }
    const patient = patients[0];
    console.log(`👤 Paciente: ${patient.name} (ID: ${patient.id})\n`);

    // 2. Find the blanqueamiento appointment
    const { data: appointments } = await supabase
        .from('Appointment')
        .select('id, date, status, paid, amount, doctorId, treatmentId, doctor:Doctor(id, name, commissionPercentage)')
        .eq('patientId', patient.id)
        .ilike('treatmentName', `%${TREATMENT_NAME_CONTAINS}%`)
        .order('date', { ascending: false })
        .limit(5);

    // If treatmentName column not available, fall back to concept-based search
    let appointment = appointments?.[0];

    if (!appointment) {
        // Try via invoices concept
        const { data: invs } = await supabase
            .from('Invoice')
            .select('id, concept, amount, appointmentId')
            .eq('patientId', patient.id)
            .ilike('concept', `%${TREATMENT_NAME_CONTAINS}%`);

        const apptId = invs?.find(i => i.appointmentId)?.appointmentId;
        if (apptId) {
            const { data: apptRow } = await supabase
                .from('Appointment')
                .select('id, date, status, paid, amount, doctorId, doctor:Doctor(id, name, commissionPercentage)')
                .eq('id', apptId)
                .single();
            appointment = apptRow;
        }
    }

    if (!appointment) {
        console.warn('⚠️  No se encontró la cita de blanqueamiento directamente.');
        console.warn('   Continuando sin appointmentId — se creará Liquidación sin appointmentId.');
    } else {
        console.log(`📅 Cita encontrada: ${appointment.date} | Estado: ${appointment.status} | Pagada: ${appointment.paid}`);
        console.log(`   Doctor: ${appointment.doctor?.name || 'N/A'} | Comisión: ${appointment.doctor?.commissionPercentage || 30}%\n`);
    }

    const appointmentId = appointment?.id || null;
    const doctorId = appointment?.doctorId || null;
    const commissionRate = appointment?.doctor?.commissionPercentage || 30;

    // 3. Current state: payments for Amaya
    const { data: payments } = await supabase
        .from('Payment')
        .select('id, amount, createdAt, notes')
        .eq('patientId', patient.id)
        .order('createdAt', { ascending: true });

    const blanqPayments = (payments || []).filter(p =>
        p.notes?.toLowerCase().includes(TREATMENT_NAME_CONTAINS.toLowerCase()) ||
        Math.abs(p.amount - INSTALMENT_AMOUNT) < 1
    );

    console.log('💰 PAGOS ACTUALES DEL BLANQUEAMIENTO:');
    blanqPayments.forEach((p, i) =>
        console.log(`   ${i + 1}. ${p.amount}€ | ${new Date(p.createdAt).toLocaleString('es-ES')} | ${p.notes || '—'}`)
    );
    const totalPaid = blanqPayments.reduce((s, p) => s + p.amount, 0);
    console.log(`   └─ TOTAL PAGADO: ${totalPaid}€ (esperado: ${FULL_TREATMENT_AMOUNT}€)\n`);

    // 4. Current state: invoices
    const { data: invoices } = await supabase
        .from('Invoice')
        .select('id, invoiceNumber, amount, concept, date')
        .eq('patientId', patient.id)
        .ilike('concept', `%${TREATMENT_NAME_CONTAINS}%`);

    console.log('📄 FACTURAS ACTUALES DEL BLANQUEAMIENTO:');
    (invoices || []).forEach((inv, i) =>
        console.log(`   ${i + 1}. ${inv.invoiceNumber || inv.id} | ${inv.amount}€ | ${inv.concept}`)
    );
    const totalInvoiced = (invoices || []).reduce((s, inv) => s + inv.amount, 0);
    console.log(`   └─ TOTAL FACTURADO: ${totalInvoiced}€\n`);

    // 5. Current state: liquidation
    const { data: liquidations } = await supabase
        .from('Liquidation')
        .select('id, grossAmount, finalAmount, treatmentName, createdAt')
        .eq('patientId', patient.id);

    // Also check by appointmentId if available
    let apptLiq = null;
    if (appointmentId) {
        const { data: liqRows } = await supabase
            .from('Liquidation')
            .select('id, grossAmount, finalAmount, treatmentName')
            .eq('appointmentId', appointmentId);
        apptLiq = liqRows?.[0] || null;
    }

    console.log(`📊 LIQUIDACIÓN EXISTENTE: ${apptLiq ? `Sí (${apptLiq.grossAmount}€ bruto)` : 'NO — falta crear'}\n`);

    // ── ACTIONS ───────────────────────────────────────────────────────────────

    const missingSecondPayment = totalPaid < FULL_TREATMENT_AMOUNT - 1;
    const missingLiquidation   = !apptLiq && doctorId;

    if (!missingSecondPayment && !missingLiquidation) {
        console.log('✅ No se detectan datos faltantes. No se realizaron cambios.');
        console.log(`   Total pagado: ${totalPaid}€ | Liquidación: presente`);
        await prisma.$disconnect();
        return;
    }

    console.log('🔧 ACCIONES A REALIZAR:');
    if (missingSecondPayment) console.log(`   • Crear segundo pago de ${INSTALMENT_AMOUNT}€ (tarjeta)`);
    if (missingLiquidation)   console.log(`   • Crear Liquidación del doctor (${FULL_TREATMENT_AMOUNT}€ base, ${commissionRate}%)`);
    console.log('');

    // ── A. Restore second payment + invoice ───────────────────────────────────
    if (missingSecondPayment) {
        // Compute next invoice number
        const year = new Date(PAYMENT_DATE_RESTORED).getFullYear();
        const prefix = `F-${year}-`;
        const { data: existingInvoices } = await supabase
            .from('Invoice')
            .select('invoiceNumber')
            .ilike('invoiceNumber', `${prefix}%`);

        const maxNum = (existingInvoices || []).reduce((max, inv) => {
            const suffix = inv.invoiceNumber?.slice(prefix.length);
            const n = parseInt(suffix || '0', 10);
            return isNaN(n) ? max : Math.max(max, n);
        }, 0);
        const invoiceNumber = `${prefix}${String(maxNum + 1).padStart(4, '0')}`;

        const paymentId = crypto.randomUUID();
        const invoiceId = crypto.randomUUID();
        const invoiceItemId = crypto.randomUUID();

        // Create Payment
        const { error: payErr } = await supabase
            .from('Payment')
            .insert({
                id: paymentId,
                patientId: patient.id,
                amount: INSTALMENT_AMOUNT,
                method: 'card',
                type: 'DIRECT_CHARGE',
                notes: `${TREATMENT_NAME_CONTAINS} Domiciliario (Pago Final - Restaurado)`,
                doctorId,
                createdAt: PAYMENT_DATE_RESTORED
            });

        if (payErr) {
            console.error('❌ Error creando Payment:', payErr.message);
            await prisma.$disconnect(); process.exit(1);
        }
        console.log(`✅ Payment creado: ${paymentId} | ${INSTALMENT_AMOUNT}€`);

        // Create Invoice
        const concept = `${TREATMENT_NAME_CONTAINS} Domiciliario`;
        const { error: invErr } = await supabase
            .from('Invoice')
            .insert({
                id: invoiceId,
                invoiceNumber,
                patientId: patient.id,
                amount: INSTALMENT_AMOUNT,
                date: PAYMENT_DATE_RESTORED,
                status: 'issued',
                paymentMethod: 'card',
                concept,
                appointmentId,
                relatedPaymentId: paymentId
            });

        if (invErr) {
            console.error('❌ Error creando Invoice:', invErr.message);
            await prisma.$disconnect(); process.exit(1);
        }
        console.log(`✅ Invoice creado: ${invoiceNumber} | ${INSTALMENT_AMOUNT}€`);

        // Create InvoiceItem
        await supabase.from('InvoiceItem').insert({
            id: invoiceItemId,
            invoiceId,
            name: concept,
            price: INSTALMENT_AMOUNT
        });

        // Link payment → invoice
        await supabase.from('Payment').update({ invoiceId }).eq('id', paymentId);

        console.log('');
    }

    // ── B. Mark appointment as paid/Completed ─────────────────────────────────
    if (appointmentId && (!appointment.paid || appointment.status !== 'Completed')) {
        const { error: apptErr } = await supabase
            .from('Appointment')
            .update({ paid: true, status: 'Completed' })
            .eq('id', appointmentId);

        if (apptErr) console.warn('⚠️  No se pudo actualizar estado de cita:', apptErr.message);
        else console.log(`✅ Cita marcada como Completed/paid`);
    }

    // ── C. Create Liquidation ─────────────────────────────────────────────────
    if (missingLiquidation) {
        const labCost = 0;
        const finalAmount = (FULL_TREATMENT_AMOUNT - labCost) * (commissionRate / 100);

        const { error: liqErr } = await supabase
            .from('Liquidation')
            .insert({
                id: crypto.randomUUID(),
                doctorId,
                appointmentId,
                grossAmount: FULL_TREATMENT_AMOUNT,
                baseAmount: FULL_TREATMENT_AMOUNT,
                labCost,
                commissionRate,
                finalAmount,
                referralCommission: 0,
                referralEntityName: null,
                treatmentName: `${TREATMENT_NAME_CONTAINS} Domiciliario`,
                patientName: patient.name,
                paymentMethod: 'card',
                status: 'PENDING',
                createdAt: PAYMENT_DATE_RESTORED
            });

        if (liqErr) {
            console.error('❌ Error creando Liquidación:', liqErr.message);
        } else {
            console.log(`✅ Liquidación creada: ${FULL_TREATMENT_AMOUNT}€ bruto → ${finalAmount.toFixed(2)}€ para el doctor (${commissionRate}%)`);
        }
    }

    console.log('\n════════════════════════════════════════');
    console.log('  Restauración completada.');
    console.log('  Ejecuta verify-amaya-totals.js para verificar.');
    console.log('════════════════════════════════════════\n');

    await prisma.$disconnect();
}

main().catch(async e => {
    console.error('❌ Error fatal:', e.message);
    await prisma.$disconnect();
    process.exit(1);
});
