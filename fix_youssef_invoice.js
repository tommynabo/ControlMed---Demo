#!/usr/bin/env node
/**
 * Investigar y corregir la factura de Youssef el kabouri:
 *  - Eliminar: F-2026-1776705517433 "Primera Visita" 60€ (card, 23/04/2026) — incorrecta
 *  - Crear: nueva factura "Extracción Simple" con el importe correcto en la caja del 23/04/2026
 *
 * USO:
 *   node fix_youssef_invoice.js            → sólo diagnóstico (DRY RUN)
 *   node fix_youssef_invoice.js --apply    → aplica el cambio
 *   node fix_youssef_invoice.js --apply --amount=120  → aplica con importe específico
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const WRONG_INVOICE_NUMBER = 'F-2026-1776705517433';
const TARGET_DATE = '2026-04-23';

const APPLY = process.argv.includes('--apply');
const amountArg = process.argv.find(a => a.startsWith('--amount='));
const FORCED_AMOUNT = amountArg ? parseFloat(amountArg.split('=')[1]) : null;

async function main() {
    console.log('══════════════════════════════════════════════════');
    console.log('  CORRECCIÓN FACTURA YOUSSEF EL KABOURI');
    console.log('══════════════════════════════════════════════════');
    console.log(APPLY ? '⚠️  MODO: APLICAR CAMBIOS REALES' : '🔍 MODO: DIAGNÓSTICO (dry-run)\n');

    // ─── 1. Obtener datos de la factura incorrecta ─────────────────────────────
    console.log(`\n📄 1. Buscando factura incorrecta: ${WRONG_INVOICE_NUMBER}`);
    const { data: wrongInvoice, error: e1 } = await supabase
        .from('Invoice')
        .select('id, invoiceNumber, amount, date, concept, status, paymentMethod, patientId, appointmentId, relatedPaymentId')
        .eq('invoiceNumber', WRONG_INVOICE_NUMBER)
        .single();

    if (e1 || !wrongInvoice) {
        console.error('❌ No se encontró la factura:', e1?.message || 'no data');
        process.exit(1);
    }

    console.log(`   ✅ Factura encontrada:`);
    console.log(`      ID:          ${wrongInvoice.id}`);
    console.log(`      Concepto:    ${wrongInvoice.concept}`);
    console.log(`      Importe:     ${wrongInvoice.amount}€`);
    console.log(`      Fecha:       ${wrongInvoice.date}`);
    console.log(`      Método:      ${wrongInvoice.paymentMethod}`);
    console.log(`      PatientId:   ${wrongInvoice.patientId}`);
    console.log(`      PaymentId:   ${wrongInvoice.relatedPaymentId}`);
    console.log(`      ApptId:      ${wrongInvoice.appointmentId || 'ninguno'}`);

    // ─── 2. Datos del paciente ─────────────────────────────────────────────────
    console.log(`\n👤 2. Datos del paciente`);
    const { data: patient } = await supabase
        .from('Patient')
        .select('id, name, dni, phone, historyNumber')
        .eq('id', wrongInvoice.patientId)
        .single();

    if (patient) {
        console.log(`   Nombre:   ${patient.name}`);
        console.log(`   HC:       ${patient.historyNumber}`);
        console.log(`   DNI:      ${patient.dni}`);
        console.log(`   Teléfono: ${patient.phone}`);
    }

    // ─── 3. Citas de Youssef ────────────────────────────────────────────────────
    console.log(`\n📅 3. Todas las citas de ${patient?.name || 'paciente'} (últimas 30)`);
    const { data: appointments } = await supabase
        .from('Appointment')
        .select('id, date, time, treatmentName, status, paid, amount, doctorId')
        .eq('patientId', wrongInvoice.patientId)
        .is('deleted_at', null)
        .order('date', { ascending: false })
        .limit(30);

    if (appointments && appointments.length > 0) {
        // Buscar doctores
        const doctorIds = [...new Set(appointments.filter(a => a.doctorId).map(a => a.doctorId))];
        let doctorMap = {};
        if (doctorIds.length > 0) {
            const { data: doctors } = await supabase.from('Doctor').select('id, name').in('id', doctorIds);
            (doctors || []).forEach(d => { doctorMap[d.id] = d.name; });
        }

        appointments.forEach(a => {
            const isExtrac = (a.treatmentName || '').toLowerCase().includes('extrac');
            const mark = isExtrac ? '  ⭐ EXTRACCIÓN' : '';
            console.log(`   ${a.date?.split('T')[0] || a.date} ${a.time || '--:--'} | ${a.treatmentName || 'sin nombre'} | ${a.status} | paid=${a.paid} | ${a.amount ?? '?'}€ | Dr.${doctorMap[a.doctorId] || a.doctorId || '?'}${mark}`);
        });
    } else {
        console.log('   (sin citas encontradas)');
    }

    // ─── 4. Buscar cita específica de Extracción Simple ────────────────────────
    const extracAppt = (appointments || []).find(a =>
        (a.treatmentName || '').toLowerCase().includes('extrac')
    );

    if (extracAppt) {
        console.log(`\n   ⭐ Cita de Extracción encontrada:`);
        console.log(`      ID:      ${extracAppt.id}`);
        console.log(`      Fecha:   ${extracAppt.date?.split('T')[0] || extracAppt.date}`);
        console.log(`      Importe: ${extracAppt.amount ?? 'sin importe definido'}€`);
        console.log(`      Paid:    ${extracAppt.paid}`);
    } else {
        console.log(`\n   ⚠️  No se encontró cita de Extracción Simple en las últimas 30 citas`);
    }

    // ─── 5. Presupuesto de Youssef (items con extracción) ─────────────────────
    console.log(`\n💰 4. Presupuesto(s) con conceptos de Extracción`);
    const { data: budgets } = await supabase
        .from('Budget')
        .select('id, totalAmount, status, items:BudgetLineItem(id, name, price, tooth)')
        .eq('patientId', wrongInvoice.patientId);

    let extracItems = [];
    if (budgets && budgets.length > 0) {
        budgets.forEach(b => {
            (b.items || []).forEach(item => {
                if ((item.name || '').toLowerCase().includes('extrac')) {
                    extracItems.push({ budgetId: b.id, ...item });
                    console.log(`   [Budget ${b.id.slice(0,8)}] ${item.name} — ${item.price}€ (diente: ${item.tooth || '?'})`);
                }
            });
        });
        if (extracItems.length === 0) {
            console.log('   (no hay ítems de extracción en presupuestos)');
        }
    } else {
        console.log('   (sin presupuestos)');
    }

    // ─── 6. Determinar importe correcto ────────────────────────────────────────
    let correctAmount = FORCED_AMOUNT;

    if (!correctAmount) {
        // Intentar obtenerlo de la cita de extracción
        if (extracAppt?.amount) {
            correctAmount = extracAppt.amount;
            console.log(`\n✅ Importe determinado desde cita: ${correctAmount}€`);
        } else if (extracItems.length === 1) {
            correctAmount = extracItems[0].price;
            console.log(`\n✅ Importe determinado desde presupuesto: ${correctAmount}€`);
        } else if (extracItems.length > 1) {
            const total = extracItems.reduce((s, i) => s + (i.price || 0), 0);
            correctAmount = total;
            console.log(`\n✅ Importe total de ${extracItems.length} extracciones en presupuesto: ${correctAmount}€`);
        } else {
            console.log('\n⚠️  No se pudo determinar el importe automáticamente.');
            console.log('   → Usa --amount=XXX para especificarlo manualmente.');
            console.log('   → Ejemplo: node fix_youssef_invoice.js --apply --amount=120');
            if (!APPLY) {
                console.log('\n🔍 DRY RUN completado. Revisa los datos arriba y ejecuta con --apply --amount=XXX');
            }
            process.exit(0);
        }
    }

    // ─── 7. Encontrar doctor para la nueva factura ─────────────────────────────
    let doctorIdForNew = null;
    if (extracAppt?.doctorId) {
        doctorIdForNew = extracAppt.doctorId;
    } else if (appointments && appointments.length > 0) {
        // Usar el doctor de la primera cita como fallback
        doctorIdForNew = appointments[0].doctorId;
    }

    // ─── 8. Resumen del plan ────────────────────────────────────────────────────
    console.log('\n══════════════════════════════════════════════════');
    console.log('  PLAN DE ACCIÓN');
    console.log('══════════════════════════════════════════════════');
    console.log(`\n❌ ELIMINAR:`);
    console.log(`   Factura ${WRONG_INVOICE_NUMBER} — "${wrongInvoice.concept}" — ${wrongInvoice.amount}€`);
    console.log(`   + Su InvoiceItem asociado`);
    if (wrongInvoice.relatedPaymentId) {
        console.log(`   + Payment ${wrongInvoice.relatedPaymentId}`);
    }

    console.log(`\n✅ CREAR:`);
    console.log(`   Nueva factura "Extracción Simple" — ${correctAmount}€`);
    console.log(`   Fecha: ${TARGET_DATE} (caja del 23 abril)`);
    console.log(`   Método de pago: ${wrongInvoice.paymentMethod} (mismo que el incorrecto)`);
    console.log(`   Doctor: ${doctorIdForNew || 'sin doctor'}`);
    console.log(`   Paciente: ${patient?.name}`);

    if (!APPLY) {
        console.log('\n════════════════════════════════════════════════');
        console.log('  🔍 DRY RUN — no se ha modificado nada');
        console.log('  Para aplicar: node fix_youssef_invoice.js --apply');
        if (!FORCED_AMOUNT) {
            console.log(`  Si el importe ${correctAmount}€ no es correcto, usa: --amount=XXX`);
        }
        console.log('════════════════════════════════════════════════');
        return;
    }

    // ─── 9. APLICAR: Eliminar factura incorrecta ───────────────────────────────
    console.log('\n🔧 APLICANDO CAMBIOS...\n');

    console.log('1️⃣  Eliminando InvoiceItems...');
    const { error: eiErr } = await supabase
        .from('InvoiceItem')
        .delete()
        .eq('invoiceId', wrongInvoice.id);
    if (eiErr) { console.error('❌', eiErr.message); process.exit(1); }
    console.log('   ✅ InvoiceItems eliminados');

    console.log('2️⃣  Eliminando Invoice...');
    const { error: invErr } = await supabase
        .from('Invoice')
        .delete()
        .eq('id', wrongInvoice.id);
    if (invErr) { console.error('❌', invErr.message); process.exit(1); }
    console.log('   ✅ Invoice eliminado');

    // Eliminar Payment asociado
    if (wrongInvoice.relatedPaymentId) {
        console.log('3️⃣  Eliminando Payment asociado...');
        // Primero eliminar la Liquidation que apunta a este payment (si existe)
        const { error: liqErr } = await supabase
            .from('Liquidation')
            .delete()
            .eq('appointmentId', wrongInvoice.appointmentId || '__none__');
        if (liqErr && liqErr.code !== 'PGRST116') {
            console.warn('   ⚠️  Error al eliminar liquidation (no crítico):', liqErr.message);
        } else {
            console.log('   ✅ Liquidation eliminada (si existía)');
        }

        const { error: payErr } = await supabase
            .from('Payment')
            .delete()
            .eq('id', wrongInvoice.relatedPaymentId);
        if (payErr) { console.error('❌', payErr.message); process.exit(1); }
        console.log('   ✅ Payment eliminado');
    }

    // Si había una cita marcada como pagada por este invoice, revertirla
    if (wrongInvoice.appointmentId) {
        console.log('4️⃣  Marcando cita como pendiente de pago...');
        const { error: apptErr } = await supabase
            .from('Appointment')
            .update({ paid: false, status: 'COMPLETADO' })
            .eq('id', wrongInvoice.appointmentId);
        if (apptErr) console.warn('   ⚠️  No se pudo actualizar la cita:', apptErr.message);
        else console.log('   ✅ Cita actualizada (paid=false)');
    }

    // ─── 10. APLICAR: Crear nueva factura correcta ─────────────────────────────
    console.log('5️⃣  Creando nueva factura "Extracción Simple"...');

    // Generar número de factura secuencial
    const year = new Date().getFullYear();
    const prefix = `F-${year}-`;
    const { data: existingInvoices } = await supabase
        .from('Invoice')
        .select('invoiceNumber')
        .ilike('invoiceNumber', `${prefix}%`);

    const maxNum = (existingInvoices || []).reduce((max, inv) => {
        const suffix = inv.invoiceNumber.slice(prefix.length);
        const num = parseInt(suffix, 10);
        return isNaN(num) ? max : Math.max(max, num);
    }, 0);
    const newInvoiceNumber = `${prefix}${String(maxNum + 1).padStart(4, '0')}`;

    // Crear Payment
    const { createId } = (() => {
        const crypto = require('crypto');
        return { createId: () => crypto.randomUUID() };
    })();

    const newPaymentId = createId();
    const newInvoiceId = createId();

    // Crear Payment SIN invoiceId primero (FK constraint requiere que el Invoice exista antes)
    const { error: newPayErr } = await supabase
        .from('Payment')
        .insert([{
            id: newPaymentId,
            patientId: wrongInvoice.patientId,
            amount: correctAmount,
            method: wrongInvoice.paymentMethod,
            type: 'DIRECT_CHARGE',
            doctorId: doctorIdForNew || null,
            referralCommission: 0,
            createdAt: new Date(`${TARGET_DATE}T12:00:00.000Z`).toISOString()
        }]);
    if (newPayErr) { console.error('❌ Error creando Payment:', newPayErr.message); process.exit(1); }
    console.log(`   ✅ Payment creado: ${newPaymentId}`);

    // Crear Invoice
    const { error: newInvErr } = await supabase
        .from('Invoice')
        .insert([{
            id: newInvoiceId,
            invoiceNumber: newInvoiceNumber,
            patientId: wrongInvoice.patientId,
            amount: correctAmount,
            date: new Date(`${TARGET_DATE}T12:00:00.000Z`).toISOString(),
            status: 'issued',
            paymentMethod: wrongInvoice.paymentMethod,
            concept: 'Extracción Simple',
            appointmentId: extracAppt?.id || null,
            relatedPaymentId: newPaymentId
        }]);
    if (newInvErr) { console.error('❌ Error creando Invoice:', newInvErr.message); process.exit(1); }
    console.log(`   ✅ Invoice creado: ${newInvoiceNumber} (${correctAmount}€)`);

    // Actualizar Payment con el invoiceId ahora que existe el Invoice
    const { error: updatePayErr } = await supabase
        .from('Payment')
        .update({ invoiceId: newInvoiceId })
        .eq('id', newPaymentId);
    if (updatePayErr) console.warn('   ⚠️  No se pudo vincular invoiceId al Payment:', updatePayErr.message);
    else console.log(`   ✅ Payment vinculado al Invoice`);

    // Crear InvoiceItem
    const { error: newItemErr } = await supabase
        .from('InvoiceItem')
        .insert([{
            id: createId(),
            invoiceId: newInvoiceId,
            name: 'Extracción Simple',
            price: correctAmount
        }]);
    if (newItemErr) console.warn('   ⚠️  InvoiceItem no creado (no crítico):', newItemErr.message);
    else console.log('   ✅ InvoiceItem creado');

    // Crear Liquidación para el doctor
    if (doctorIdForNew) {
        console.log('6️⃣  Creando liquidación para el doctor...');
        const { data: doctor } = await supabase.from('Doctor').select('commissionPercentage').eq('id', doctorIdForNew).single();
        const commRate = doctor?.commissionPercentage || 30;
        const finalAmount = correctAmount * (commRate / 100);

        const { error: liqErr2 } = await supabase
            .from('Liquidation')
            .insert([{
                id: createId(),
                doctorId: doctorIdForNew,
                appointmentId: extracAppt?.id || null,
                grossAmount: correctAmount,
                baseAmount: correctAmount,
                labCost: 0,
                commissionRate: commRate,
                finalAmount,
                referralCommission: 0,
                treatmentName: 'Extracción Simple',
                patientName: patient?.name || 'Paciente',
                paymentMethod: wrongInvoice.paymentMethod,
                status: 'PENDING',
                createdAt: new Date().toISOString()
            }]);
        if (liqErr2) console.warn('   ⚠️  Liquidation no creada:', liqErr2.message);
        else console.log(`   ✅ Liquidación creada (${commRate}% = ${finalAmount.toFixed(2)}€)`);
    }

    // Marcar la cita de extracción como pagada (si existe)
    if (extracAppt) {
        const { error: apptPaidErr } = await supabase
            .from('Appointment')
            .update({ paid: true, status: 'Completed' })
            .eq('id', extracAppt.id);
        if (apptPaidErr) console.warn('   ⚠️  No se pudo marcar cita extracción como pagada:', apptPaidErr.message);
        else console.log('   ✅ Cita de extracción marcada como pagada');
    }

    console.log('\n══════════════════════════════════════════════════');
    console.log('  ✅ CORRECCIÓN COMPLETADA');
    console.log('══════════════════════════════════════════════════');
    console.log(`\n  Factura eliminada: ${WRONG_INVOICE_NUMBER} ("Primera Visita", ${wrongInvoice.amount}€)`);
    console.log(`  Factura creada:    ${newInvoiceNumber} ("Extracción Simple", ${correctAmount}€)`);
    console.log(`  Fecha en caja:     ${TARGET_DATE}`);
    console.log(`\n  → Recarga la caja del 23 de abril para ver el cambio.`);
}

main().catch(e => {
    console.error('❌ Error inesperado:', e.message);
    process.exit(1);
});
