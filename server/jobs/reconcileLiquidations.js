'use strict';
/**
 * reconcileLiquidations.js
 *
 * Nightly job that finds paid appointments and payments without a matching
 * Liquidation row and creates them automatically via ensureLiquidation().
 *
 * Safe to run multiple times — ensureLiquidation() is idempotent.
 *
 * Usage:
 *   const { runReconciliation } = require('./reconcileLiquidations');
 *   const result = await runReconciliation();
 *   // { created: 3, skipped: 40, errors: [] }
 */

const { getSupabase } = require('../lib/db');
const { ensureLiquidation } = require('../services/liquidationService');

/**
 * Run a full reconciliation pass.
 *
 * @param {object}  [opts]
 * @param {number}  [opts.lookbackDays=180] — How many days back to scan (default 6 months)
 * @returns {Promise<{ created: number, skipped: number, errors: Array<{id,error}> }>}
 */
async function runReconciliation({ lookbackDays = 180 } = {}) {
    const supabase = getSupabase();
    const stats = { created: 0, skipped: 0, errors: [] };

    const since = new Date();
    since.setDate(since.getDate() - lookbackDays);
    const sinceIso = since.toISOString();

    console.log(`[Reconciliation] Starting scan — lookback: ${lookbackDays} days (since ${sinceIso.substring(0, 10)})`);

    // ── 1. Appointments: paid=true, amount>0, has a doctor, no Liquidation ────
    const { data: appts, error: apptErr } = await supabase
        .from('Appointment')
        .select(`
            id,
            date,
            doctorId,
            amount,
            treatmentName,
            patientId,
            patient:Patient(name),
            invoice:Invoice(paymentMethod)
        `)
        .eq('paid', true)
        .is('deleted_at', null)
        .gt('amount', 0)
        .not('doctorId', 'is', null)
        // Only create liquidations for completed treatments, never for budget-only appointments
        .in('status', ['COMPLETADO', 'Completed'])
        .gte('date', sinceIso);

    if (apptErr) {
        console.error('[Reconciliation] Failed to query Appointments:', apptErr.message);
        stats.errors.push({ id: 'query_appointments', error: apptErr.message });
        return stats;
    }

    // Fetch all Liquidation appointmentIds in one shot to avoid N+1
    const apptIds = (appts || []).map(a => a.id);
    let coveredApptIds = new Set();
    if (apptIds.length > 0) {
        const { data: existingLiqs } = await supabase
            .from('Liquidation')
            .select('appointmentId')
            .in('appointmentId', apptIds);
        coveredApptIds = new Set((existingLiqs || []).map(l => l.appointmentId).filter(Boolean));
    }

    const missing = (appts || []).filter(a => !coveredApptIds.has(a.id));
    console.log(`[Reconciliation] Appointments — total paid: ${(appts || []).length}, missing Liquidation: ${missing.length}`);

    for (const appt of missing) {
        try {
            // Try to find the Payment linked to this appointment for idempotency
            const { data: pay } = await supabase
                .from('Payment')
                .select('id, method, amount')
                .eq('appointmentId', appt.id)
                .not('type', 'eq', 'ADVANCE_PAYMENT')
                .order('createdAt', { ascending: false })
                .limit(1)
                .maybeSingle();

            await ensureLiquidation(supabase, {
                paymentId:     pay?.id     || null,
                appointmentId: appt.id,
                doctorId:      appt.doctorId,
                grossAmount:   Number(appt.amount),
                labCost:       0,
                treatmentName: appt.treatmentName || 'Tratamiento',
                patientName:   appt.patient?.name || 'Paciente',
                paymentMethod: pay?.method || appt.invoice?.[0]?.paymentMethod || 'cash',
                // Use appointment date so it lands in the correct month's report
                createdAt:     new Date(appt.date).toISOString().replace('T00:00:00.000Z', 'T12:00:00.000Z'),
            });

            stats.created++;
            console.log(`[Reconciliation] ✅ Created Liquidation — appt: ${appt.id}, patient: ${appt.patient?.name}, date: ${appt.date}`);
        } catch (e) {
            stats.errors.push({ id: appt.id, error: e.message });
            console.error(`[Reconciliation] ❌ Failed appt ${appt.id}:`, e.message);
        }
    }

    // ── 2. Payments: DIRECT_CHARGE without a linked Liquidation ──────────────
    // Catches payments that were created without appointmentId (e.g. walk-in)
    const { data: orphanPayments } = await supabase
        .from('Payment')
        .select('id, amount, method, doctorId, patientId, patient:Patient(name), createdAt')
        .eq('type', 'DIRECT_CHARGE')
        .is('appointmentId', null)
        .not('doctorId', 'is', null)
        .gt('amount', 0)
        .gte('createdAt', sinceIso);

    const payIds = (orphanPayments || []).map(p => p.id);
    let coveredPayIds = new Set();
    if (payIds.length > 0) {
        const { data: existingPayLiqs } = await supabase
            .from('Liquidation')
            .select('paymentId')
            .in('paymentId', payIds);
        coveredPayIds = new Set((existingPayLiqs || []).map(l => l.paymentId).filter(Boolean));
    }

    const missingPayments = (orphanPayments || []).filter(p => !coveredPayIds.has(p.id));
    console.log(`[Reconciliation] Orphan payments — total: ${(orphanPayments || []).length}, missing Liquidation: ${missingPayments.length}`);

    for (const pay of missingPayments) {
        try {
            await ensureLiquidation(supabase, {
                paymentId:     pay.id,
                appointmentId: null,
                doctorId:      pay.doctorId,
                grossAmount:   Number(pay.amount),
                labCost:       0,
                treatmentName: 'Tratamiento',
                patientName:   pay.patient?.name || 'Paciente',
                paymentMethod: pay.method || 'cash',
                createdAt:     pay.createdAt,
            });

            stats.created++;
            console.log(`[Reconciliation] ✅ Created Liquidation (orphan payment) — pay: ${pay.id}`);
        } catch (e) {
            stats.errors.push({ id: pay.id, error: e.message });
            console.error(`[Reconciliation] ❌ Failed payment ${pay.id}:`, e.message);
        }
    }

    stats.skipped = (appts?.length || 0) + (orphanPayments?.length || 0) - missing.length - missingPayments.length;

    console.log(`[Reconciliation] Done — created: ${stats.created}, skipped: ${stats.skipped}, errors: ${stats.errors.length}`);
    return stats;
}

module.exports = { runReconciliation };
