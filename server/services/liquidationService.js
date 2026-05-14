'use strict';
/**
 * liquidationService.js
 *
 * Single source of truth for creating / updating Liquidation rows.
 * All payment paths (regular, split, wallet, reconciliation) MUST go through
 * ensureLiquidation() — never write Liquidation rows inline.
 *
 * Idempotency guarantees (checked in order):
 *   1. paymentId  — if a row with this paymentId already exists → return it.
 *   2. appointmentId + doctorId — structural dedup; update & link paymentId.
 *   3. Otherwise  — create a new row.
 */

const crypto = require('crypto');

/**
 * Upsert a Liquidation row safely.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {object} opts
 * @param {string|null}  opts.paymentId           — Payment.id (idempotency key)
 * @param {string|null}  opts.appointmentId        — Appointment.id (structural key)
 * @param {string}       opts.doctorId             — REQUIRED
 * @param {number}       opts.grossAmount          — Total billed to patient
 * @param {number}       [opts.baseAmount]         — Gross minus referral markup
 * @param {number}       [opts.labCost]            — Lab cost deducted before commission
 * @param {number}       [opts.commissionRate]     — % override; resolved from Doctor if omitted
 * @param {string}       [opts.treatmentName]
 * @param {string}       [opts.patientName]
 * @param {string}       [opts.paymentMethod]
 * @param {number}       [opts.referralCommission]
 * @param {string|null}  [opts.referralEntityName]
 * @param {string}       [opts.createdAt]          — ISO string; use appointment.date for correct month
 * @returns {Promise<object>} The Liquidation row
 * @throws  {Error}       If doctorId is not found or the DB write fails
 */
async function ensureLiquidation(supabase, {
    paymentId       = null,
    appointmentId   = null,
    doctorId,
    grossAmount,
    baseAmount,
    labCost         = 0,
    commissionRate,
    treatmentName   = 'Tratamiento',
    patientName     = 'Paciente',
    paymentMethod   = 'cash',
    referralCommission   = 0,
    referralEntityName   = null,
    createdAt,
}) {
    if (!doctorId) throw new Error('ensureLiquidation: doctorId es obligatorio');
    if (!grossAmount || grossAmount <= 0) throw new Error('ensureLiquidation: grossAmount debe ser > 0');

    // ── 1. Resolve commission rate from Doctor if not provided ───────────────
    let resolvedRate = commissionRate;
    if (resolvedRate == null) {
        const { data: doc, error: docErr } = await supabase
            .from('Doctor')
            .select('commissionPercentage')
            .eq('id', doctorId)
            .single();
        if (docErr || !doc) throw new Error(`ensureLiquidation: Doctor '${doctorId}' no encontrado`);
        resolvedRate = doc.commissionPercentage || 30;
    }

    const effectiveBase = baseAmount ?? grossAmount;
    const finalAmount   = (effectiveBase - labCost) * (resolvedRate / 100);

    const payload = {
        doctorId,
        appointmentId:       appointmentId || null,
        paymentId:           paymentId     || null,
        grossAmount,
        baseAmount:          effectiveBase,
        labCost,
        commissionRate:      resolvedRate,
        finalAmount,
        referralCommission:  referralCommission  || 0,
        referralEntityName:  referralEntityName  || null,
        treatmentName,
        patientName,
        paymentMethod,
        status: 'PENDING',
    };

    // ── 2. Idempotency: check by paymentId ───────────────────────────────────
    if (paymentId) {
        const { data: existing } = await supabase
            .from('Liquidation')
            .select('id, manuallyEdited')
            .eq('paymentId', paymentId)
            .maybeSingle();
        if (existing) {
            // If manually edited, only update non-financial metadata fields
            const updatePayload = existing.manuallyEdited
                ? { treatmentName: payload.treatmentName, patientName: payload.patientName, paymentMethod: payload.paymentMethod, status: payload.status }
                : payload;
            const { data: updated, error: updErr } = await supabase
                .from('Liquidation')
                .update(updatePayload)
                .eq('id', existing.id)
                .select()
                .single();
            if (updErr) throw new Error(`ensureLiquidation update(paymentId): ${updErr.message}`);
            return updated;
        }
    }

    // ── 3. Structural dedup: check by appointmentId + doctorId (single-concept rows only) ──
    if (appointmentId) {
        const { data: existing } = await supabase
            .from('Liquidation')
            .select('id, manuallyEdited')
            .eq('appointmentId', appointmentId)
            .eq('doctorId', doctorId)
            .is('itemIndex', null)
            .maybeSingle();
        if (existing) {
            // If manually edited, only update non-financial metadata fields
            const updatePayload = existing.manuallyEdited
                ? { paymentId: payload.paymentId, treatmentName: payload.treatmentName, patientName: payload.patientName, paymentMethod: payload.paymentMethod, status: payload.status }
                : payload;
            const { data: updated, error: updErr } = await supabase
                .from('Liquidation')
                .update(updatePayload)
                .eq('id', existing.id)
                .select()
                .single();
            if (updErr) throw new Error(`ensureLiquidation update(appointmentId): ${updErr.message}`);
            return updated;
        }
    }

    // ── 4. Create new row ─────────────────────────────────────────────────────
    const row = {
        id: crypto.randomUUID(),
        ...payload,
        createdAt: createdAt ?? new Date().toISOString(),
    };

    const { data: created, error: createErr } = await supabase
        .from('Liquidation')
        .insert(row)
        .select()
        .single();

    if (createErr) throw new Error(`ensureLiquidation insert: ${createErr.message}`);
    return created;
}

module.exports = { ensureLiquidation };
