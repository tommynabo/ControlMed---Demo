#!/usr/bin/env node
/**
 * Diagnóstico: pagos de Kelvin en mayo 2026
 * Muestra pagos, facturas y estado de liquidación para identificar qué falta.
 * USO: node diagnose_kelvin_may_payment.js
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const MAY_START = '2026-05-01T00:00:00.000Z';
const MAY_END   = '2026-05-31T23:59:59.999Z';

async function main() {
    console.log('══════════════════════════════════════════════════');
    console.log('  DIAGNÓSTICO: KELVIN — PAGOS MAYO 2026');
    console.log('══════════════════════════════════════════════════\n');

    // 1. Buscar paciente Kelvin
    const { data: patients, error: pErr } = await supabase
        .from('Patient')
        .select('id, name, historyNumber')
        .ilike('name', '%kelvin%');

    if (pErr || !patients?.length) {
        console.error('❌ No se encontró ningún paciente con nombre "Kelvin":', pErr?.message);
        return;
    }

    console.log(`👤 Pacientes encontrados (${patients.length}):`);
    patients.forEach(p => console.log(`   ID: ${p.id}  |  ${p.name}  |  NH: ${p.historyNumber}`));
    console.log();

    for (const patient of patients) {
        console.log(`\n${'─'.repeat(60)}`);
        console.log(`PACIENTE: ${patient.name} (${patient.historyNumber || 'sin NH'})`);
        console.log(`${'─'.repeat(60)}`);

        // 2. Pagos del mes de mayo
        const { data: payments, error: pmErr } = await supabase
            .from('Payment')
            .select('id, amount, method, createdAt, appointmentId, doctorId, invoiceId, type')
            .eq('patientId', patient.id)
            .gte('createdAt', MAY_START)
            .lte('createdAt', MAY_END)
            .order('createdAt', { ascending: true });

        if (pmErr) {
            console.error('   ❌ Error al buscar pagos:', pmErr.message);
            continue;
        }

        if (!payments?.length) {
            console.log('   ⚠️  Sin pagos registrados en mayo 2026');
            continue;
        }

        console.log(`\n💳 PAGOS (${payments.length}):`);
        for (const pay of payments) {
            console.log(`\n   Pago ID: ${pay.id}`);
            console.log(`   Importe: ${pay.amount}€  |  Método: ${pay.method}  |  Tipo: ${pay.type || 'DIRECT_CHARGE'}`);
            console.log(`   Fecha:   ${pay.createdAt}`);
            console.log(`   Doctor ID: ${pay.doctorId || '⚠️  NULL'}`);
            console.log(`   Invoice ID: ${pay.invoiceId || '⚠️  NULL (sin factura)'}`);
            console.log(`   Appointment ID: ${pay.appointmentId || '⚠️  NULL'}`);

            // 3. Detalles de la factura
            if (pay.invoiceId) {
                const { data: inv } = await supabase
                    .from('Invoice')
                    .select('id, invoiceNumber, concept, amount, status, date, paymentMethod')
                    .eq('id', pay.invoiceId)
                    .single();
                if (inv) {
                    const statusIcon = inv.status === 'issued' ? '✅' : inv.status === 'partial' ? '⚠️ ' : '❓';
                    console.log(`   📄 Factura: ${inv.invoiceNumber} — "${inv.concept}"`);
                    console.log(`      Importe: ${inv.amount}€  |  Estado: ${statusIcon} ${inv.status}  |  Fecha: ${inv.date}`);
                } else {
                    console.log(`   ❌ Factura ${pay.invoiceId} no encontrada en BD`);
                }
            }

            // 4. Detalles de la cita
            if (pay.appointmentId) {
                const { data: appt } = await supabase
                    .from('Appointment')
                    .select('id, amount, status, paid, doctorId, treatmentName, date, budgetId')
                    .eq('id', pay.appointmentId)
                    .single();
                if (appt) {
                    console.log(`   📅 Cita: ${appt.date} — "${appt.treatmentName || 'sin tratamiento'}"`);
                    console.log(`      Importe cita: ${appt.amount || '⚠️  NULL'}€  |  Pagada: ${appt.paid ? '✅ sí' : '❌ no'}  |  Estado: ${appt.status}`);
                    console.log(`      Doctor cita ID: ${appt.doctorId || '⚠️  NULL'}`);

                    // 5. Todos los pagos de esa cita (para ver si es pago parcial)
                    const { data: apptPayments } = await supabase
                        .from('Payment')
                        .select('id, amount, method, createdAt')
                        .eq('appointmentId', pay.appointmentId)
                        .order('createdAt', { ascending: true });
                    if (apptPayments?.length) {
                        const sumPaid = apptPayments.reduce((s, p) => s + parseFloat(p.amount), 0);
                        console.log(`      Total pagos para esta cita: ${apptPayments.length} pagos → ${sumPaid}€`);
                        apptPayments.forEach((ap, i) =>
                            console.log(`        ${i + 1}. ${ap.amount}€ (${ap.method}) — ${ap.createdAt}`)
                        );
                        if (appt.amount && sumPaid < parseFloat(appt.amount) - 0.01) {
                            console.log(`      ⚠️  PAGO PARCIAL: faltan ${(parseFloat(appt.amount) - sumPaid).toFixed(2)}€`);
                        } else if (appt.amount) {
                            console.log(`      ✅ Pago completo`);
                        }
                    }
                } else {
                    console.log(`   ❌ Cita ${pay.appointmentId} no encontrada en BD`);
                }

                // 6. Liquidaciones para esa cita
                const { data: liqs } = await supabase
                    .from('Liquidation')
                    .select('id, grossAmount, finalAmount, commissionRate, treatmentName, status, doctorId, createdAt')
                    .eq('appointmentId', pay.appointmentId);
                if (liqs?.length) {
                    console.log(`   💰 Liquidaciones (${liqs.length}):`);
                    liqs.forEach(l =>
                        console.log(`      ID: ${l.id}  |  Bruto: ${l.grossAmount}€  |  Neto: ${l.finalAmount}€  |  Doctor: ${l.doctorId}  |  Estado: ${l.status}`)
                    );
                } else {
                    console.log(`   ❌ SIN LIQUIDACIÓN para esta cita → el doctor no aparecerá en el informe de mayo`);
                }
            }
        }
    }

    // 7. Buscar también si hay pagos de Kelvin SIN appointmentId en mayo
    // (pagos sueltos que no están ligados a cita)
    const allKelvinIds = patients.map(p => p.id);
    const { data: orphanPayments } = await supabase
        .from('Payment')
        .select('id, amount, method, createdAt, invoiceId, doctorId')
        .in('patientId', allKelvinIds)
        .is('appointmentId', null)
        .gte('createdAt', MAY_START)
        .lte('createdAt', MAY_END);

    if (orphanPayments?.length) {
        console.log('\n⚠️  PAGOS SIN CITA ASOCIADA (pagos sueltos):');
        orphanPayments.forEach(p =>
            console.log(`   ${p.amount}€ (${p.method}) — ${p.createdAt} — invoiceId: ${p.invoiceId || 'NULL'}`)
        );
    }

    console.log('\n══════════════════════════════════════════════════');
    console.log('  FIN DEL DIAGNÓSTICO');
    console.log('  Si ves "SIN LIQUIDACIÓN", ejecuta:');
    console.log('  node fix_kelvin_may_liquidation.js');
    console.log('══════════════════════════════════════════════════\n');
}

main().catch(err => {
    console.error('Error fatal:', err.message);
    process.exit(1);
});
