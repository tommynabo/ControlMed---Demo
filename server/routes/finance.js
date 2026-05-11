'use strict';
const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const { prisma, getSupabase } = require('../lib/db');
const financeService = require('../services/financeService');
const quipuService = require('../services/quipuService');
const invoiceService = require('../services/invoiceService');
const budgetService = require('../services/budgetService');
const gmailService = require('../services/gmailService');
const { calculateWalletBalance } = require('../lib/utils');
const { logAudit } = require('../lib/audit');

const router = express.Router();

// ─── Helper: mark BudgetLineItems as paid after a treatment payment ───────────
// Priority: use exact budgetItemIds from the Appointment record (most reliable).
// Falls back to serviceName prefix matching for backwards compatibility.
async function markBudgetLineItemsPaid(supabase, { budgetId, treatmentIds, treatmentName, appointmentId }) {
    if (!budgetId) return;
    try {
        // ── Priority 1: Use exact BudgetLineItem IDs stored on the Appointment ──
        if (appointmentId) {
            const { data: apptRow } = await supabase
                .from('Appointment')
                .select('"budgetItemIds"')
                .eq('id', appointmentId)
                .single();
            if (apptRow?.budgetItemIds) {
                let itemIds = [];
                try {
                    itemIds = typeof apptRow.budgetItemIds === 'string'
                        ? JSON.parse(apptRow.budgetItemIds)
                        : apptRow.budgetItemIds;
                } catch (_) {}
                if (Array.isArray(itemIds) && itemIds.length > 0) {
                    await supabase
                        .from('BudgetLineItem')
                        .update({ paid: true })
                        .in('id', itemIds)
                        .eq('paid', false);
                    return; // Done — exact match succeeded
                }
            }
        }

        // ── Priority 2 (fallback): match by PatientTreatment serviceName ──
        if (Array.isArray(treatmentIds) && treatmentIds.length > 0) {
            const { data: pts } = await supabase
                .from('PatientTreatment')
                .select('serviceName')
                .in('id', treatmentIds);
            if (pts && pts.length > 0) {
                for (const pt of pts) {
                    if (!pt.serviceName) continue;
                    await supabase
                        .from('BudgetLineItem')
                        .update({ paid: true })
                        .eq('budgetId', budgetId)
                        .eq('paid', false)
                        .ilike('name', `${pt.serviceName}%`);
                }
            }
        } else if (treatmentName) {
            // ── Priority 3 (last resort): match by treatment name/concept ──
            await supabase
                .from('BudgetLineItem')
                .update({ paid: true })
                .eq('budgetId', budgetId)
                .eq('paid', false)
                .ilike('name', `${treatmentName}%`);
        }
    } catch (e) {
        console.error('⚠️ Error marcando BudgetLineItems como pagados (no crítico):', e.message);
    }
}


router.post('/financing', async (req, res) => {
    try {
        const result = await financeService.createFinancingPlan(prisma, req.body);
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── INSTALLMENTS ─────────────────────────────────────────────────────────────
router.get('/installments/:planId', async (req, res) => {
    try {
        const installments = await prisma.installment.findMany({
            where: { planId: req.params.planId },
            orderBy: { dueDate: 'asc' }
        });
        res.json(installments);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/installments/:id/pay', async (req, res) => {
    try {
        const updated = await financeService.markInstallmentPaid(prisma, req.params.id);
        res.json(updated);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/installments/process-due', async (req, res) => {
    try {
        const results = await financeService.processDueInstallments(prisma);
        res.json({ processed: results.length, results });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/plans/:patientId', async (req, res) => {
    try {
        const plans = await prisma.treatmentPlan.findMany({
            where: { patientId: req.params.patientId },
            include: { installments: { orderBy: { dueDate: 'asc' } } },
            orderBy: { startDate: 'desc' }
        });
        res.json(plans);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── LIQUIDATIONS ─────────────────────────────────────────────────────────────
router.get('/liquidations', async (req, res) => {
    try {
        const liquidations = await prisma.liquidation.findMany({ orderBy: { createdAt: 'desc' } });
        res.json(liquidations);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/liquidations/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { treatmentName, doctorId, grossAmount, labCost, commissionRate } = req.body;
        const data = {};
        if (treatmentName !== undefined) data.treatmentName = treatmentName;
        if (doctorId !== undefined) data.doctorId = doctorId;
        if (grossAmount !== undefined) data.grossAmount = Number(grossAmount);
        if (labCost !== undefined) data.labCost = Number(labCost);
        if (commissionRate !== undefined) {
            data.commissionRate = Number(commissionRate);
        }
        // Recalculate finalAmount if numeric fields changed
        if (data.grossAmount !== undefined || data.labCost !== undefined || data.commissionRate !== undefined) {
            const existing = await prisma.liquidation.findUnique({ where: { id } });
            if (!existing) return res.status(404).json({ error: 'Liquidation not found' });
            const g = data.grossAmount !== undefined ? data.grossAmount : existing.grossAmount;
            const l = data.labCost !== undefined ? data.labCost : existing.labCost;
            const r = data.commissionRate !== undefined ? data.commissionRate : existing.commissionRate;
            data.finalAmount = (g - l) * (r / 100);
        }
        const updated = await prisma.liquidation.update({ where: { id }, data });
        res.json(updated);
    } catch (e) {
        console.error('Error updating liquidation:', e);
        res.status(500).json({ error: e.message });
    }
});

// POST /finance/liquidations/:id/split
// Divide una liquidación única (itemIndex=null) en N filas — una por BudgetLineItem
router.post('/liquidations/:id/split', async (req, res) => {
    try {
        const { id } = req.params;
        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }

        const existing = await prisma.liquidation.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ error: 'Liquidación no encontrada' });
        if (existing.itemIndex !== null)
            return res.status(400).json({ error: 'Esta liquidación ya está dividida' });
        if (!existing.appointmentId)
            return res.status(400).json({ error: 'La liquidación no tiene cita vinculada; no se puede dividir automáticamente' });

        const { data: appt } = await supabase
            .from('Appointment').select('id, budgetId, budgetItemIds').eq('id', existing.appointmentId).single();
        if (!appt?.budgetId)
            return res.status(400).json({ error: 'La cita no tiene presupuesto vinculado; asigna un presupuesto primero' });

        // Use ONLY the items linked to THIS appointment (budgetItemIds), not the whole budget
        let specificItemIds = null;
        if (appt.budgetItemIds) {
            try {
                specificItemIds = typeof appt.budgetItemIds === 'string'
                    ? JSON.parse(appt.budgetItemIds)
                    : appt.budgetItemIds;
                if (!Array.isArray(specificItemIds) || specificItemIds.length === 0) specificItemIds = null;
            } catch (_) { specificItemIds = null; }
        }

        if (!specificItemIds || specificItemIds.length < 2)
            return res.status(400).json({ error: 'Para dividir, primero edita la cita y selecciona los conceptos del presupuesto que se realizaron (necesitas marcar al menos 2).' });

        const { data: itemData } = await supabase
            .from('BudgetLineItem').select('id, name, price, quantity, discount')
            .in('id', specificItemIds).gt('price', 0);
        const items = specificItemIds.map(iid => itemData?.find(d => d.id === iid)).filter(Boolean);

        if (!items || items.length < 2)
            return res.status(400).json({ error: `Esta cita tiene ${items?.length ?? 0} concepto(s) con precio — necesitas al menos 2 para dividir` });

        const rate = existing.commissionRate || 30;
        const newRows = await prisma.$transaction(async (tx) => {
            // Delete the original row + any orphaned itemIndex rows left by previous
            // failed attempts (they share the same appointmentId + doctorId).
            await tx.liquidation.deleteMany({
                where: {
                    appointmentId: existing.appointmentId,
                    doctorId:      existing.doctorId,
                }
            });
            const created = [];
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const itemGross = Number(item.price) * (Number(item.quantity) || 1) * (1 - (Number(item.discount) || 0) / 100);
                created.push(await tx.liquidation.create({
                    data: {
                        id: crypto.randomUUID(),
                        doctorId:           existing.doctorId,
                        appointmentId:      existing.appointmentId,
                        paymentId:          null,   // paymentId is @unique — can't share across N rows
                        itemIndex:          i,
                        grossAmount:        itemGross,
                        baseAmount:         itemGross,
                        labCost:            0,
                        commissionRate:     rate,
                        finalAmount:        itemGross * (rate / 100),
                        referralCommission: existing.referralCommission || 0,
                        referralEntityName: existing.referralEntityName || null,
                        treatmentName:      item.name || `Tratamiento ${i + 1}`,
                        patientName:        existing.patientName,
                        paymentMethod:      existing.paymentMethod,
                        status:             existing.status || 'PENDING',
                        createdAt:          existing.createdAt,
                    }
                }));
            }
            return created;
        });

        res.json({ split: newRows.length, rows: newRows });
    } catch (e) {
        console.error('Error splitting liquidation:', e);
        res.status(500).json({ error: e.message });
    }
});

router.get('/liquidations/summary', async (req, res) => {
    try {
        const { doctorId, month, year, dateFrom, dateTo, groupByDay } = req.query;
        if (!doctorId) return res.status(400).json({ error: 'doctorId is required' });

        if (dateFrom && dateTo) {
            let supabase;
            try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }

            // Query ALL liquidations for this doctor (no date filter on the query itself).
            // We then filter in JS by appointment.date when available, falling back to
            // createdAt — this ensures payments processed late (e.g. in May for April
            // appointments) still appear in the correct month's report.
            const { data: liquidations, error: liqError } = await supabase
                .from('Liquidation')
                .select('*, appointment:Appointment(date, patientId, patient:Patient(historyNumber, isODA, name))')
                .eq('doctorId', doctorId)
                .order('createdAt', { ascending: true });
            if (liqError) throw liqError;

            const startDate = new Date(dateFrom);
            const endDateFilter = new Date(dateTo); endDateFilter.setHours(23, 59, 59, 999);

            const filtered = (liquidations || []).filter(liq => {
                const refDate = liq.appointment?.date
                    ? new Date(liq.appointment.date)
                    : new Date(liq.createdAt);
                return refDate >= startDate && refDate <= endDateFilter;
            });

            const records = filtered.map(liq => {
                const apptPatient = liq.appointment?.patient || {};
                // Use appointment date as the display date so the PDF matches the real visit date
                const displayDate = liq.appointment?.date || liq.createdAt;
                return {
                    id: liq.id,
                    fecha: displayDate,
                    concepto: liq.treatmentName || 'Tratamiento',
                    importeCobrado: liq.grossAmount || 0,
                    baseAmount: liq.baseAmount ?? liq.grossAmount ?? 0,
                    nombrePaciente: apptPatient.name || liq.patientName || 'Desconocido',
                    numeroHistoria: apptPatient.historyNumber || '-',
                    doctorId: liq.doctorId,
                    referralCommission: liq.referralCommission || 0,
                    referralEntityName: liq.referralEntityName || null,
                    isODA: apptPatient.isODA || false
                };
            });
            const total = records.reduce((s, r) => s + r.importeCobrado, 0);

            // Optional daily grouping
            if (groupByDay === 'true') {
                const byDay = {};
                for (const r of records) {
                    const day = String(r.fecha).substring(0, 10);
                    if (!byDay[day]) byDay[day] = [];
                    byDay[day].push(r);
                }
                const dailyGroups = Object.entries(byDay)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([date, dayRecords]) => ({
                        date,
                        records: dayRecords,
                        dayTotal: dayRecords.reduce((s, r) => s + r.importeCobrado, 0)
                    }));
                return res.json({ records, dailyGroups, dateFrom, dateTo, doctorId, total });
            }

            return res.json({ records, dateFrom, dateTo, doctorId, total });
        }

        const monthInt = parseInt(month, 10) || new Date().getMonth() + 1;
        const yearInt  = parseInt(year,  10) || new Date().getFullYear();
        const startDate = new Date(yearInt, monthInt - 1, 1);
        const endDate   = new Date(yearInt, monthInt, 0, 23, 59, 59);

        // Try Supabase first (authoritative source), then fall back to Prisma.
        // This prevents a 404 when Kevin or another doctor exists in Supabase
        // but Prisma's local cache/schema is out of sync.
        let doctor = null;
        try {
            const sbDoctor = getSupabase();
            const { data: docRow } = await sbDoctor
                .from('Doctor')
                .select('id, name, specialization, commissionPercentage')
                .eq('id', doctorId)
                .single();
            doctor = docRow || null;
        } catch (_) {}
        if (!doctor) {
            try { doctor = await prisma.doctor.findUnique({ where: { id: doctorId } }); } catch (_) {}
        }
        if (!doctor) return res.status(404).json({ error: 'Doctor not found' });

        let liquidations = [];
        try {
            // Fetch all liquidations for this doctor and filter by appointment date
            // (not createdAt) so that payments processed in a later month still appear
            // in the correct period. Falls back to createdAt when appointmentId is null.
            let supabase2;
            try { supabase2 = getSupabase(); } catch (_) { supabase2 = null; }

            if (supabase2) {
                const { data: liqRows } = await supabase2
                    .from('Liquidation')
                    .select('*, appointment:Appointment(date)')
                    .eq('doctorId', doctorId)
                    .order('createdAt', { ascending: true });

                liquidations = (liqRows || []).filter(l => {
                    const refDate = l.appointment?.date
                        ? new Date(l.appointment.date)
                        : new Date(l.createdAt);
                    return refDate >= startDate && refDate <= endDate;
                });

                // Deduplicate by composite key (appointmentId + itemIndex):
                // Multi-concept appointments generate one row per BudgetLineItem (itemIndex 0,1,2...).
                // We must NOT collapse those — only remove truly identical duplicate rows.
                const seenKeys = new Set();
                liquidations = liquidations.filter(l => {
                    if (!l.appointmentId) return true;
                    // Allow multiple rows per appointment if they have different itemIndex values
                    const key = l.itemIndex != null ? `${l.appointmentId}::${l.itemIndex}` : l.appointmentId;
                    if (seenKeys.has(key)) return false;
                    seenKeys.add(key);
                    return true;
                });
            } else {
                liquidations = await prisma.liquidation.findMany({
                    where: { doctorId, createdAt: { gte: startDate, lte: endDate } },
                    orderBy: { createdAt: 'asc' }
                });
            }
        } catch (_) {}

        const totals = { totalGross: 0, totalLabCost: 0, totalCommission: 0, totalToPay: 0 };
        liquidations.forEach(l => {
            totals.totalGross      += l.grossAmount  || 0;
            totals.totalLabCost    += l.labCost      || 0;
            totals.totalCommission += l.finalAmount  || 0;
            totals.totalToPay      += l.finalAmount  || 0;
        });

        const MONTHS = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        res.json({ doctor: { id: doctor.id, name: doctor.name, specialization: doctor.specialization }, period: `${MONTHS[monthInt]} ${yearInt}`, treatments: liquidations, totals, count: liquidations.length });
    } catch (e) {
        console.error('Error fetching liquidation summary:', e);
        res.status(500).json({ error: e.message });
    }
});

// ─── INVOICES ─────────────────────────────────────────────────────────────────

// PUT /finance/invoices/:id — actualiza la fecha de una factura (para reasignar a otra caja)
router.put('/invoices/:id', async (req, res) => {
    try {
        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }

        const { id } = req.params;
        const { date, paymentMethod } = req.body;

        if (!id) return res.status(400).json({ error: 'Invoice ID is required' });

        const invoiceUpdate = {};
        if (date) {
            if (!/^\d{4}-\d{2}-\d{2}/.test(date)) return res.status(400).json({ error: 'Valid date is required (YYYY-MM-DD)' });
            invoiceUpdate.date = date;
        }
        if (paymentMethod) {
            const allowed = ['cash', 'card', 'transfer'];
            if (!allowed.includes(paymentMethod)) return res.status(400).json({ error: 'paymentMethod must be cash, card or transfer' });
            invoiceUpdate.paymentMethod = paymentMethod;
        }
        if (Object.keys(invoiceUpdate).length === 0) return res.status(400).json({ error: 'Nothing to update' });

        const { data, error } = await supabase
            .from('Invoice')
            .update(invoiceUpdate)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // If paymentMethod changed, keep the linked Payment.method in sync
        if (paymentMethod) {
            await supabase
                .from('Payment')
                .update({ method: paymentMethod.toUpperCase() })
                .eq('invoiceId', id);
        }

        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/invoices', async (req, res) => {
    try {
        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }

        const { data, error } = await supabase.from('Invoice').select('*, items:InvoiceItem(*)').order('date', { ascending: false });
        if (error) return res.status(500).json({ error: error.message });

        // Enrich with liquidation data (doctorId) linked via appointmentId
        const appointmentIds = (data || []).map(inv => inv.appointmentId).filter(Boolean);
        let liquidationMap = {};
        if (appointmentIds.length > 0) {
            const { data: liqData } = await supabase
                .from('Liquidation')
                .select('id, doctorId, appointmentId')
                .in('appointmentId', appointmentIds);
            (liqData || []).forEach(l => {
                liquidationMap[l.appointmentId] = { liquidationId: l.id, assignedDoctorId: l.doctorId };
            });
        }
        const enriched = (data || []).map(inv => ({
            ...inv,
            ...(inv.appointmentId && liquidationMap[inv.appointmentId] ? liquidationMap[inv.appointmentId] : {})
        }));
        res.json(enriched);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/invoices/appointment/:appointmentId', async (req, res) => {
    try {
        const invoice = await prisma.invoice.findFirst({
            where: { appointmentId: req.params.appointmentId },
            orderBy: { date: 'desc' }
        });
        if (!invoice) return res.status(404).json({ error: 'Invoice not found for this appointment' });
        res.json(invoice);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /invoices/:id/download — devuelve la URL efímera pública de Quipu para abrir en navegador
router.get('/invoices/:id/download', async (req, res) => {
    try {
        const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id } });
        if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

        // Si tiene ID externo de Quipu, pedimos una URL efímera fresca (sin auth de navegador)
        if (invoice.externalId) {
            try {
                const urls = await quipuService.getInvoiceUrls(invoice.externalId);
                if (urls?.preview) return res.json({ url: urls.preview });
                if (urls?.download) return res.json({ url: urls.download });
            } catch (qErr) {
                console.warn('⚠️ [Quipu] Could not get ephemeral URL, falling back to stored URL:', qErr.message);
            }
        }

        // Fallback: URL almacenada en BD (puede requerir auth, pero es lo que hay)
        if (invoice.url) return res.json({ url: invoice.url });

        return res.status(404).json({ error: 'No PDF URL available for this invoice' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── PAYMENTS: GET ────────────────────────────────────────────────────────────
router.get('/payments', async (req, res) => {
    try {
        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }

        const { data, error } = await supabase.from('Payment').select('*').order('createdAt', { ascending: false });
        if (error) return res.status(500).json({ error: error.message });

        // Enrich with doctor names
        const doctorIds = [...new Set((data || []).filter(p => p.doctorId).map(p => p.doctorId))];
        let doctorMap = {};
        if (doctorIds.length > 0) {
            const { data: doctors } = await supabase.from('Doctor').select('id, name').in('id', doctorIds);
            (doctors || []).forEach(d => { doctorMap[d.id] = d.name; });
        }
        const enriched = (data || []).map(p => ({ ...p, doctorName: p.doctorId ? (doctorMap[p.doctorId] || null) : null }));
        res.json(enriched);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── PAYMENTS: CREATE ─────────────────────────────────────────────────────────
// ─── PAYMENTS: GET by appointment ────────────────────────────────────────────
router.get('/payments/by-appointment/:appointmentId', async (req, res) => {
    try {
        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }

        const { data, error } = await supabase
            .from('Payment')
            .select('*')
            .eq('appointmentId', req.params.appointmentId)
            .order('createdAt', { ascending: true });

        if (error) return res.status(500).json({ error: error.message });
        res.json(data || []);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/payments/create', async (req, res) => {
    try {
        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }

        const { patientId, amount, method, type, notes, appointmentId, budgetId, paymentDate } = req.body;
        const idempotencyKey = req.body.idempotencyKey || null;

        if (!patientId || !amount || !method) {
            return res.status(400).json({ error: 'patientId, amount, and method are required' });
        }

        // ── Idempotency: if the same key was already processed, return the existing result ──
        if (idempotencyKey) {
            const existing = await prisma.payment.findUnique({ where: { idempotencyKey } });
            if (existing) {
                const existingInvoice = existing.invoiceId
                    ? await prisma.invoice.findUnique({ where: { id: existing.invoiceId } })
                    : null;
                console.log(`[finance] Idempotent replay for key ${idempotencyKey}`);
                return res.status(200).json({ success: true, payment: existing, invoice: existingInvoice, isPartial: false, isFinal: true, remainingBalance: 0 });
            }
        }

        const numericAmount = parseFloat(amount);
        if (isNaN(numericAmount) || numericAmount <= 0) {
            return res.status(400).json({ error: 'Invalid amount' });
        }

        // Resolve patient and doctor
        const { data: patient } = await supabase.from('Patient').select('*').eq('id', patientId).single();
        if (!patient) return res.status(404).json({ error: 'Patient not found' });

        let doctor = null;
        let doctorId = req.body.doctorId;

        // If no doctorId was sent (or empty string), fall back to the appointment's doctorId
        if ((!doctorId || doctorId === '') && appointmentId) {
            const { data: apptRow } = await supabase
                .from('Appointment')
                .select('doctorId')
                .eq('id', appointmentId)
                .single();
            if (apptRow?.doctorId) doctorId = apptRow.doctorId;
        }

        // Safeguard: warn if the supplied doctorId differs from the appointment's doctorId.
        // This catches accidental mis-assignments before they create wrong Liquidation records.
        if (doctorId && appointmentId) {
            try {
                const { data: apptCheck } = await supabase
                    .from('Appointment')
                    .select('doctorId')
                    .eq('id', appointmentId)
                    .single();
                if (apptCheck?.doctorId && apptCheck.doctorId !== doctorId) {
                    console.warn(
                        `[finance] Doctor mismatch on payment: appointmentId=${appointmentId} ` +
                        `appointment.doctorId=${apptCheck.doctorId} but payment.doctorId=${doctorId}. ` +
                        `Overriding to appointment doctor to keep Liquidation consistent.`
                    );
                    // Override to appointment doctor unless this is an intentional ODA/referral split
                    // (splits go through /payments/create-split, not here)
                    doctorId = apptCheck.doctorId;
                }
            } catch (_) {} // Non-fatal safeguard
        }

        if (doctorId) {
            const { data: d } = await supabase.from('Doctor').select('*').eq('id', doctorId).single();
            doctor = d;
        }

        // Resolve treatment name
        let solvedTreatmentName = req.body.treatmentName || 'Servicio';
        const treatmentId = req.body.treatmentId;
        if (treatmentId && !req.body.treatmentName) {
            const { data: t } = await supabase.from('Treatment').select('name').eq('id', treatmentId).single();
            if (t) solvedTreatmentName = t.name;
        }

        // ── Server-side partial-payment detection ──────────────────────────────
        // We determine if this is a partial or final payment based on actual DB data,
        // not the client-supplied isPartial flag (which can be stale).
        let isPartialPayment = false;
        let isFinalPayment = false;
        let appointmentAmount = null;
        let allPreviousPayments = [];

        if (appointmentId && type !== 'ADVANCE_PAYMENT') {
            const { data: apptRow } = await supabase
                .from('Appointment')
                .select('amount')
                .eq('id', appointmentId)
                .single();
            appointmentAmount = apptRow?.amount ? parseFloat(apptRow.amount) : null;

            if (appointmentAmount && appointmentAmount > 0) {
                const { data: prevPayments } = await supabase
                    .from('Payment')
                    .select('id, amount, method, "createdAt"')
                    .eq('appointmentId', appointmentId);
                allPreviousPayments = prevPayments || [];

                const alreadyPaid = allPreviousPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
                const totalAfterThis = alreadyPaid + numericAmount;

                // 0.01 tolerance for floating point rounding
                if (totalAfterThis >= appointmentAmount - 0.01) {
                    isFinalPayment = true;
                    isPartialPayment = false;
                } else {
                    isPartialPayment = true;
                    isFinalPayment = false;
                }
            }
        }

        // ── Quipu invoice creation — only for non-partial payments ─────────────
        let quipuResult = { success: false };
        if (!isPartialPayment) {
            try {
                const contactData = {
                    name: patient.name || 'Paciente',
                    email: patient.email,
                    tax_id: patient.dni,
                    address: patient.address,
                    city: patient.city,
                    zip_code: patient.zipCode || patient.zip_code
                };
                const contact = await quipuService.getOrCreateContact(contactData);
                if (contact && contact.id) {
                    const today = (paymentDate || new Date().toISOString()).split('T')[0];
                    const histSuffix = patient.historyNumber ? ` — Nº Historia: ${patient.historyNumber}` : '';
                    // For consolidated invoices use the full appointment amount; otherwise use the current payment amount
                    const invoiceAmount = (isFinalPayment && appointmentAmount) ? appointmentAmount : numericAmount;
                    quipuResult = await quipuService.createInvoice(
                        contact.id,
                        [{ name: `${solvedTreatmentName}${histSuffix}`, quantity: 1, price: invoiceAmount }],
                        today, today,
                        method === 'card' ? 'credit_card' : method
                    );
                }
            } catch (qErr) {
                console.error('⚠️ Quipu Error (continuing with local only):', qErr.response?.data || qErr.message);
            }
        }

        // ── Pre-transaction Supabase reads (moved outside to reduce tx duration) ──────
        // Resolve budget commission so doctor is paid on the original price,
        // and the markup goes to the referral entity separately.
        let budgetCommissionPct = 0;
        let referralEntityName = null;
        if (budgetId) {
            try {
                const { data: bgt } = await supabase.from('Budget').select('commissionPercent, referralEntityName').eq('id', budgetId).single();
                if (bgt) {
                    budgetCommissionPct = Number(bgt.commissionPercent) || 0;
                    referralEntityName = bgt.referralEntityName || null;
                }
            } catch (_) {}
        }
        // baseAmount = price without the referral markup
        const baseAmount = budgetCommissionPct > 0
            ? numericAmount / (1 + budgetCommissionPct / 100)
            : numericAmount;
        const referralCommission = numericAmount - baseAmount;

        // Doctor's base = baseAmount minus items that go to the clinic (e.g. OPG).
        // If the appointment has a service_breakdown, sum only billable services.
        let doctorBaseAmount = baseAmount;
        if (appointmentId) {
            try {
                const { data: apptRow } = await supabase
                    .from('Appointment')
                    .select('service_breakdown')
                    .eq('id', appointmentId)
                    .single();
                if (apptRow?.service_breakdown && Array.isArray(apptRow.service_breakdown) && apptRow.service_breakdown.length > 0) {
                    const billableTotal = apptRow.service_breakdown
                        .filter(s => !s.excludeFromLiquidation)
                        .reduce((sum, s) => sum + (Number(s.price) || 0), 0);
                    const allTotal = apptRow.service_breakdown
                        .reduce((sum, s) => sum + (Number(s.price) || 0), 0);
                    // Scale proportionally to baseAmount in case there's a referral commission
                    if (allTotal > 0) {
                        doctorBaseAmount = baseAmount * (billableTotal / allTotal);
                    }
                }
            } catch (_) {}
        }

        // Effective payment timestamp (supports back-dating past payments)
        const effectiveDate = paymentDate ? new Date(paymentDate) : new Date();
        const effectiveDateISO = effectiveDate.toISOString();

        const result = await prisma.$transaction(async (tx) => {

            // Create the Payment record, now including appointmentId for traceability
            const payment = await tx.payment.create({
                data: {
                    id: crypto.randomUUID(),
                    patientId,
                    appointmentId: appointmentId || null,
                    budgetId: budgetId || null,
                    amount: numericAmount,
                    method,
                    type,
                    notes: notes || null,
                    doctorId: doctor?.id || null,
                    referralCommission: referralCommission || 0,
                    referralEntityName: referralEntityName || null,
                    idempotencyKey: idempotencyKey || null,
                    createdAt: effectiveDateISO
                }
            });

            // Update appointment status
            if (appointmentId) {
                await tx.appointment.update({
                    where: { id: appointmentId },
                    data: isPartialPayment
                        ? { paid: false, status: 'EN_PROCESO' }
                        : { paid: true, status: 'Completed' }
                });
            }

            // ── Invoice: only created on the FINAL payment ─────────────────────
            // Partial payments do NOT generate an invoice — they are tracked only
            // via the Payment record (with appointmentId). This avoids duplicate
            // invoices and makes it impossible to "pay" an already-paid appointment.
            let invoice = null;
            let invoiceNumber = null;

            if (!isPartialPayment) {
                // Sequential invoice number (F-YYYY-NNNN)
                const year = new Date().getFullYear();
                const prefix = `F-${year}-`;
                const existing = await tx.invoice.findMany({
                    where: { invoiceNumber: { startsWith: prefix } },
                    select: { invoiceNumber: true }
                });
                const maxNum = existing.reduce((max, inv) => {
                    const suffix = inv.invoiceNumber.slice(prefix.length);
                    const num = parseInt(suffix, 10);
                    return isNaN(num) ? max : Math.max(max, num);
                }, 0);
                invoiceNumber = `${prefix}${String(maxNum + 1).padStart(4, '0')}`;

                // Build paymentBreakdown for consolidated invoices (≥2 payments on same appointment)
                let paymentBreakdown = null;
                const invoiceAmount = (isFinalPayment && appointmentAmount) ? appointmentAmount : numericAmount;
                const invoicePaymentMethod = (isFinalPayment && allPreviousPayments.length > 0) ? 'mixed' : method;

                if (isFinalPayment && allPreviousPayments.length > 0) {
                    // Aggregate all payments (previous + current) by method
                    const breakdownMap = {};
                    for (const p of [...allPreviousPayments, { method, amount: numericAmount }]) {
                        const m = p.method || 'cash';
                        breakdownMap[m] = (breakdownMap[m] || 0) + parseFloat(p.amount);
                    }
                    paymentBreakdown = Object.entries(breakdownMap).map(([m, a]) => ({
                        method: m,
                        amount: Math.round(a * 100) / 100
                    }));
                }

                invoice = await tx.invoice.create({
                    data: {
                        id: crypto.randomUUID(),
                        invoiceNumber,
                        externalId: quipuResult.success ? String(quipuResult.id) : null,
                        url: quipuResult.success ? quipuResult.pdf_url : null,
                        patientId,
                        amount: invoiceAmount,
                        date: effectiveDate,
                        status: 'issued',
                        paymentMethod: invoicePaymentMethod,
                        paymentBreakdown,
                        concept: solvedTreatmentName,
                        appointmentId: appointmentId || null,
                        relatedPaymentId: payment.id
                    }
                });

                await tx.invoiceItem.create({
                    data: {
                        id: crypto.randomUUID(),
                        invoiceId: invoice.id,
                        name: solvedTreatmentName,
                        price: invoiceAmount
                    }
                });
                // Link invoice back to the final payment
                await tx.payment.update({ where: { id: payment.id }, data: { invoiceId: invoice.id } });
            }

            // ── Mandatory Liquidation creation ─────────────────────────────────────────────
            // For DIRECT_CHARGE final payments a Liquidation MUST exist.
            // If the doctor cannot be resolved, throw — this rolls back the entire tx so no
            // orphaned Payment or Invoice is ever left behind without a Liquidation.
            //
            // Multi-concept support: when the appointment's budget has ≥2 line items with
            // price > 0, one Liquidation row is created per item (itemIndex = 0, 1, 2, ...).
            // This allows setting different commission rates per concept in the liquidation view.
            // Single-concept appointments continue to create one row with itemIndex = null.
            let liquidation = null;
            if (type !== 'ADVANCE_PAYMENT' && !isPartialPayment) {
                if (!doctor) {
                    throw new Error(
                        `No se puede crear el pago: doctor no encontrado para la cita/pago ` +
                        `(paciente: ${patient?.name || patientId}). Asegúrate de que la cita tiene un doctor asignado.`
                    );
                }
                const rawRate = doctor.commissionPercentage || 30;
                const labCost = req.body.costeLab || 0;
                // Use the full appointment amount as gross for accurate commission on consolidated payments
                const grossForLiquidation = (isFinalPayment && appointmentAmount) ? appointmentAmount : numericAmount;
                const finalAmount = (doctorBaseAmount - labCost) * (rawRate / 100);

                if (appointmentId) {
                    // ── Check if this appointment's budget has multiple concepts ──────────
                    let budgetItems = [];
                    if (budgetId) {
                        budgetItems = await tx.budgetLineItem.findMany({
                            where: { budgetId, price: { gt: 0 } },
                            orderBy: { id: 'asc' }
                        });
                    }

                    if (budgetItems.length >= 2) {
                        // ── Multi-concept path: one Liquidation row per BudgetLineItem ───
                        for (let i = 0; i < budgetItems.length; i++) {
                            const item = budgetItems[i];
                            const itemGross = item.price * (item.quantity || 1);
                            const itemFinal = itemGross * (rawRate / 100);
                            const existingItem = await tx.liquidation.findFirst({
                                where: { appointmentId, doctorId: doctor.id, itemIndex: i }
                            });
                            if (existingItem) {
                                await tx.liquidation.update({
                                    where: { id: existingItem.id },
                                    data: {
                                        grossAmount: itemGross,
                                        baseAmount: itemGross,
                                        commissionRate: rawRate,
                                        finalAmount: itemFinal,
                                        treatmentName: item.name,
                                        patientName: patient?.name || 'Paciente',
                                        paymentMethod: method,
                                        status: 'PENDING'
                                    }
                                });
                            } else {
                                await tx.liquidation.create({
                                    data: {
                                        id: crypto.randomUUID(),
                                        doctorId: doctor.id,
                                        appointmentId,
                                        itemIndex: i,
                                        paymentId: null,
                                        grossAmount: itemGross,
                                        baseAmount: itemGross,
                                        labCost: 0,
                                        commissionRate: rawRate,
                                        finalAmount: itemFinal,
                                        referralCommission: 0,
                                        referralEntityName: null,
                                        treatmentName: item.name,
                                        patientName: patient?.name || 'Paciente',
                                        paymentMethod: method,
                                        status: 'PENDING',
                                        createdAt: new Date().toISOString()
                                    }
                                });
                            }
                        }
                        liquidation = true; // multi-item handled; no single row to return

                    } else {
                        // ── Single-concept path: one Liquidation row (existing behavior) ─
                        const existingLiquidation = await tx.liquidation.findFirst({
                            where: { appointmentId, doctorId: doctor.id, itemIndex: null }
                        });

                        if (existingLiquidation) {
                            liquidation = await tx.liquidation.update({
                                where: { id: existingLiquidation.id },
                                data: {
                                    paymentId: payment.id,
                                    doctorId: doctor.id,
                                    grossAmount: grossForLiquidation,
                                    baseAmount: doctorBaseAmount,
                                    labCost,
                                    commissionRate: rawRate,
                                    finalAmount,
                                    referralCommission: referralCommission || 0,
                                    referralEntityName: referralEntityName || null,
                                    treatmentName: solvedTreatmentName,
                                    patientName: patient?.name || 'Paciente',
                                    paymentMethod: method,
                                    status: 'PENDING'
                                }
                            });
                        } else {
                            liquidation = await tx.liquidation.create({
                                data: { id: crypto.randomUUID(), paymentId: payment.id, doctorId: doctor.id, appointmentId, itemIndex: null, grossAmount: grossForLiquidation, baseAmount: doctorBaseAmount, labCost, commissionRate: rawRate, finalAmount, referralCommission: referralCommission || 0, referralEntityName: referralEntityName || null, treatmentName: solvedTreatmentName, patientName: patient?.name || 'Paciente', paymentMethod: method, status: 'PENDING', createdAt: effectiveDateISO }
                            });
                        }
                    }
                } else {
                    liquidation = await tx.liquidation.create({
                        data: { id: crypto.randomUUID(), paymentId: payment.id, doctorId: doctor.id, appointmentId: null, itemIndex: null, grossAmount: grossForLiquidation, baseAmount: doctorBaseAmount, labCost, commissionRate: rawRate, finalAmount, referralCommission: referralCommission || 0, referralEntityName: referralEntityName || null, treatmentName: solvedTreatmentName, patientName: patient?.name || 'Paciente', paymentMethod: method, status: 'PENDING', createdAt: effectiveDateISO }
                    });
                }
            }

            if (type === 'ADVANCE_PAYMENT' || method === 'wallet') {
                const balanceAdjustment = method === 'wallet' ? -numericAmount : numericAmount;
                await tx.patient.update({ where: { id: patientId }, data: { wallet: { increment: balanceAdjustment } } });
            }

            return {
                payment,
                invoice,
                payroll: liquidation,
                pdfUrl: quipuResult.success ? quipuResult.pdf_url : null,
                previewUrl: quipuResult.success ? quipuResult.preview_url : null,
                isPartial: isPartialPayment,
                isFinal: isFinalPayment,
                remainingBalance: isPartialPayment && appointmentAmount
                    ? Math.max(0, appointmentAmount - allPreviousPayments.reduce((s, p) => s + parseFloat(p.amount), 0) - numericAmount)
                    : 0
            };
        }, { timeout: 15000 });

        // ── Post-transaction Supabase side effects (moved outside to reduce tx duration) ──
        if (!result.isPartial) {
            try {
                const supabasePost = getSupabase();
                const treatmentIdsFromBody = req.body.treatmentIds;
                if (Array.isArray(treatmentIdsFromBody) && treatmentIdsFromBody.length > 0) {
                    await supabasePost
                        .from('PatientTreatment')
                        .update({ status: 'COMPLETADO' })
                        .in('id', treatmentIdsFromBody)
                        .eq('patientId', patientId);
                } else if (appointmentId) {
                    const { data: appt } = await supabasePost
                        .from('Appointment')
                        .select('treatmentId')
                        .eq('id', appointmentId)
                        .single();
                    if (appt?.treatmentId) {
                        await supabasePost
                            .from('PatientTreatment')
                            .update({ status: 'COMPLETADO' })
                            .eq('serviceId', appt.treatmentId)
                            .eq('patientId', patientId)
                            .not('status', 'in', '("COMPLETADO","PAGADO")');
                    }
                }
                await markBudgetLineItemsPaid(supabasePost, {
                    budgetId: budgetId || req.body.budgetId,
                    treatmentIds: req.body.treatmentIds,
                    treatmentName: solvedTreatmentName,
                    appointmentId
                });
            } catch (sideEffectErr) {
                console.error('⚠️ Side-effect update failed (payment already saved):', sideEffectErr.message);
            }
        }

        res.status(200).json({ success: true, ...result });

        // Gmail invoice email (fire-and-forget, never blocks the response)
        if (patient.email && result.invoice) {
            (async () => {
                try {
                    const invoiceNumber = result.invoice.invoiceNumber;
                    const pdfUrl = result.pdfUrl;
                    let attachments = [];

                    if (pdfUrl) {
                        try {
                            const pdfResponse = await axios.get(pdfUrl, { responseType: 'arraybuffer', timeout: 10000 });
                            attachments = [{ filename: `factura_${invoiceNumber}.pdf`, content: Buffer.from(pdfResponse.data) }];
                        } catch (pdfErr) {
                            console.warn('⚠️ No se pudo descargar el PDF de Quipu:', pdfErr.message);
                        }
                    }

                    const pdfSection = pdfUrl
                        ? `<p style="margin:16px 0;"><a href="${pdfUrl}" style="background:#1d4ed8;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold;">Ver / Descargar Factura PDF</a></p>`
                        : '';

                    const htmlBody = `
                        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1e293b;">
                            <h2 style="color:#1d4ed8;">Factura #${invoiceNumber}</h2>
                            <p>Estimado/a <strong>${patient.name}</strong>,</p>
                            <p>Le enviamos su factura correspondiente al pago realizado en nuestra clínica.</p>
                            <table style="width:100%;border-collapse:collapse;margin:20px 0;">
                                <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;"><strong>Concepto:</strong></td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">${result.invoice.concept}</td></tr>
                                <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;"><strong>Importe:</strong></td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">€${result.invoice.amount.toFixed(2)}</td></tr>
                                <tr><td style="padding:8px;"><strong>Método de pago:</strong></td><td style="padding:8px;">${method}</td></tr>
                            </table>
                            ${pdfSection}
                            <p style="margin-top:24px;color:#64748b;font-size:13px;">Gracias por confiar en nosotros.</p>
                        </div>`;

                    await gmailService.sendGmail({
                        to: patient.email,
                        subject: `Factura #${invoiceNumber} — Su recibo`,
                        htmlBody,
                        attachments,
                    });
                    console.log(`📧 Factura enviada por email a ${patient.email}`);
                } catch (mailErr) {
                    console.error('⚠️ Error enviando email de factura (no crítico):', mailErr.message);
                }
            })();
        }

        // Audit log (fire-and-forget, never throws)
        try {
            const supabase = getSupabase();
            logAudit(supabase, { userId: req.user?.id, userRole: req.user?.role, action: 'CREATE', resourceType: 'payments', resourceId: result.payment?.id, newValues: { patientId, amount: numericAmount, method, type, invoiceNumber: result.invoice?.invoiceNumber }, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
        } catch (_) {}
    } catch (e) {
        console.error('Error creating payment:', e);
        res.status(500).json({ error: e.message || 'Unknown transaction error' });
    }
});

// ─── PAYMENTS: CREATE SPLIT (tratamiento compartido entre varios doctores) ────
// body: { patientId, totalAmount, method, appointmentId?, budgetId?, concept, notes?,
//         splits: [{ doctorId, amount, treatmentName, labCost? }] }
// Creates ONE Payment + ONE Invoice + ONE Liquidation per doctor split.
router.post('/payments/create-split', async (req, res) => {
    try {
        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }

        const { patientId, totalAmount, method, appointmentId, budgetId, concept, notes, splits, paymentDate } = req.body;
        const splitEffectiveDate = paymentDate ? new Date(paymentDate) : new Date();
        const splitEffectiveDateISO = splitEffectiveDate.toISOString();
        const idempotencyKey = req.body.idempotencyKey || null;

        if (!patientId || !totalAmount || !method || !splits || !Array.isArray(splits) || splits.length === 0) {
            return res.status(400).json({ error: 'patientId, totalAmount, method, and splits[] are required' });
        }

        const numericTotal = parseFloat(totalAmount);
        if (isNaN(numericTotal) || numericTotal <= 0) {
            return res.status(400).json({ error: 'Invalid totalAmount' });
        }

        // ── Idempotency check ──────────────────────────────────────────────────
        if (idempotencyKey) {
            const existing = await prisma.payment.findUnique({ where: { idempotencyKey } });
            if (existing) {
                console.log(`[finance] Idempotent replay (split) for key ${idempotencyKey}`);
                return res.status(200).json({ success: true, payment: existing });
            }
        }

        const { data: patient } = await supabase.from('Patient').select('*').eq('id', patientId).single();
        if (!patient) return res.status(404).json({ error: 'Patient not found' });

        // Resolve doctors for each split
        const resolvedSplits = await Promise.all(splits.map(async (s) => {
            let doctor = null;
            if (s.doctorId) {
                const { data: d } = await supabase.from('Doctor').select('*').eq('id', s.doctorId).single();
                doctor = d;
            }
            return { ...s, doctor, amount: parseFloat(s.amount) || 0 };
        }));

        // Attempt Quipu invoice
        let quipuResult = { success: false };

        // Resolve referral commission from budget
        let splitBudgetCommissionPct = 0;
        let splitReferralEntity = null;
        if (budgetId) {
            try {
                const { data: bgt } = await getSupabase().from('Budget').select('commissionPercent, referralEntityName').eq('id', budgetId).single();
                if (bgt) {
                    splitBudgetCommissionPct = Number(bgt.commissionPercent) || 0;
                    splitReferralEntity = bgt.referralEntityName || null;
                }
            } catch (_) {}
        }
        // Total referral commission across all splits (proportional to each split amount)
        const splitReferralTotal = splitBudgetCommissionPct > 0
            ? numericTotal - (numericTotal / (1 + splitBudgetCommissionPct / 100))
            : 0;
        try {
            const contactData = {
                name: patient.name || 'Paciente',
                email: patient.email,
                tax_id: patient.dni,
                address: patient.address,
                city: patient.city,
                zip_code: patient.zipCode || patient.zip_code
            };
            const contact = await quipuService.getOrCreateContact(contactData);
            if (contact && contact.id) {
                const today = new Date().toISOString().split('T')[0];
                const histSuffix = patient.historyNumber ? ` — Nº Historia: ${patient.historyNumber}` : '';
                const lineItems = resolvedSplits.map(s => ({
                    name: `${s.treatmentName || 'Tratamiento'}${histSuffix}`,
                    quantity: 1,
                    price: s.amount
                }));
                quipuResult = await quipuService.createInvoice(
                    contact.id, lineItems, today, today,
                    method === 'card' ? 'credit_card' : method
                );
            }
        } catch (qErr) {
            console.error('⚠️ Quipu Error (split, continuing):', qErr.response?.data || qErr.message);
        }

        const result = await prisma.$transaction(async (tx) => {
            // Single payment for the total
            const payment = await tx.payment.create({
                data: {
                    id: crypto.randomUUID(),
                    patientId,
                    budgetId: budgetId || null,
                    amount: numericTotal,
                    method,
                    type: 'DIRECT_CHARGE',
                    notes: notes || null,
                    doctorId: resolvedSplits[0]?.doctor?.id || null,
                    referralCommission: splitReferralTotal || 0,
                    referralEntityName: splitReferralEntity || null,
                    idempotencyKey: idempotencyKey || null,
                    createdAt: splitEffectiveDateISO
                }
            });

            if (appointmentId) {
                await tx.appointment.update({
                    where: { id: appointmentId },
                    data: { paid: true, status: 'Completed' }
                });
            }

            // Sequential invoice number
            const year = splitEffectiveDate.getFullYear();
            const prefix = `F-${year}-`;
            const existing = await tx.invoice.findMany({
                where: { invoiceNumber: { startsWith: prefix } },
                select: { invoiceNumber: true }
            });
            const maxNum = existing.reduce((max, inv) => {
                const suffix = inv.invoiceNumber.slice(prefix.length);
                const num = parseInt(suffix, 10);
                return isNaN(num) ? max : Math.max(max, num);
            }, 0);
            const invoiceNumber = `${prefix}${String(maxNum + 1).padStart(4, '0')}`;

            const solvedConcept = concept || resolvedSplits.map(s => s.treatmentName).filter(Boolean).join(' + ') || 'Servicio';

            const invoice = await tx.invoice.create({
                data: {
                    id: crypto.randomUUID(),
                    invoiceNumber,
                    externalId: quipuResult.success ? String(quipuResult.id) : null,
                    url: quipuResult.success ? quipuResult.pdf_url : null,
                    patientId,
                    amount: numericTotal,
                    date: splitEffectiveDate,
                    status: 'issued',
                    paymentMethod: method,
                    concept: solvedConcept,
                    appointmentId: appointmentId || null,
                    relatedPaymentId: payment.id
                }
            });

            for (const s of resolvedSplits) {
                await tx.invoiceItem.create({
                    data: { id: crypto.randomUUID(), invoiceId: invoice.id, name: s.treatmentName || 'Tratamiento', price: s.amount }
                });
            }

            await tx.payment.update({ where: { id: payment.id }, data: { invoiceId: invoice.id } });

            // One Liquidation per doctor split — mandatory, throws if any split has no doctor
            const liquidations = [];
            for (const s of resolvedSplits) {
                if (!s.doctor) {
                    throw new Error(
                        `No se puede crear el pago: uno de los splits no tiene doctor asignado ` +
                        `(doctorId: ${s.doctorId || 'null'}). Comprueba los datos e inténtalo de nuevo.`
                    );
                }
                const rawRate = s.doctor.commissionPercentage || 30;
                const labCost = s.labCost || 0;
                // Doctor is paid on base price (without referral markup)
                const splitBase = splitBudgetCommissionPct > 0
                    ? s.amount / (1 + splitBudgetCommissionPct / 100)
                    : s.amount;
                const splitRefComm = s.amount - splitBase;
                const finalAmount = (splitBase - labCost) * (rawRate / 100);

                const existingLiq = appointmentId
                    ? await tx.liquidation.findFirst({ where: { appointmentId, doctorId: s.doctor.id } })
                    : null;

                let liq;
                if (existingLiq) {
                    liq = await tx.liquidation.update({
                        where: { id: existingLiq.id },
                        data: { paymentId: payment.id, grossAmount: s.amount, baseAmount: splitBase, labCost, commissionRate: rawRate, finalAmount, referralCommission: splitRefComm || 0, referralEntityName: splitReferralEntity || null, treatmentName: s.treatmentName || 'Tratamiento', patientName: patient.name || 'Paciente', paymentMethod: method, status: 'PENDING' }
                    });
                } else {
                    liq = await tx.liquidation.create({
                        data: { id: crypto.randomUUID(), paymentId: payment.id, doctorId: s.doctor.id, appointmentId: appointmentId || null, grossAmount: s.amount, baseAmount: splitBase, labCost, commissionRate: rawRate, finalAmount, referralCommission: splitRefComm || 0, referralEntityName: splitReferralEntity || null, treatmentName: s.treatmentName || 'Tratamiento', patientName: patient.name || 'Paciente', paymentMethod: method, status: 'PENDING', createdAt: splitEffectiveDateISO }
                    });
                }
                liquidations.push(liq);
            }

            return {
                payment, invoice, liquidations,
                pdfUrl: quipuResult.success ? quipuResult.pdf_url : null,
                previewUrl: quipuResult.success ? quipuResult.preview_url : null
            };
        }, { timeout: 15000 });

        // ── Post-transaction Supabase side effects (moved outside to reduce tx duration) ──
        try {
            const supabasePost = getSupabase();
            const treatmentIdsFromBody = req.body.treatmentIds;
            if (Array.isArray(treatmentIdsFromBody) && treatmentIdsFromBody.length > 0) {
                await supabasePost
                    .from('PatientTreatment')
                    .update({ status: 'COMPLETADO' })
                    .in('id', treatmentIdsFromBody)
                    .eq('patientId', patientId);
            } else if (appointmentId) {
                const { data: appt } = await supabasePost
                    .from('Appointment')
                    .select('treatmentId')
                    .eq('id', appointmentId)
                    .single();
                if (appt?.treatmentId) {
                    await supabasePost
                        .from('PatientTreatment')
                        .update({ status: 'COMPLETADO' })
                        .eq('serviceId', appt.treatmentId)
                        .eq('patientId', patientId)
                        .not('status', 'in', '("COMPLETADO","PAGADO")');
                }
            }
            await markBudgetLineItemsPaid(supabasePost, {
                budgetId,
                treatmentIds: req.body.treatmentIds,
                treatmentName: concept,
                appointmentId
            });
        } catch (sideEffectErr) {
            console.error('⚠️ Split side-effect update failed (payment already saved):', sideEffectErr.message);
        }

        res.status(200).json({ success: true, ...result });

        try {
            logAudit(supabase, { userId: req.user?.id, userRole: req.user?.role, action: 'CREATE', resourceType: 'payments_split', resourceId: result.payment?.id, newValues: { patientId, totalAmount: numericTotal, method, splits: splits.length }, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
        } catch (_) {}
    } catch (e) {
        console.error('Error creating split payment:', e);
        res.status(500).json({ error: e.message || 'Unknown error' });
    }
});

// ─── PAYMENTS: TRANSFER advance to treatment ─────────────────────────────────
router.post('/payments/transfer', async (req, res) => {    try {
        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }

        const { patientId, sourcePaymentId, amount, treatmentId, treatmentName, doctorId, notes, budgetId } = req.body;

        if (!patientId || !sourcePaymentId || !amount || !doctorId) {
            return res.status(400).json({ error: 'Campos requeridos: patientId, sourcePaymentId, amount, doctorId' });
        }

        const { data: sourcePayment, error: sourceError } = await supabase.from('Payment').select('*').eq('id', sourcePaymentId).single();
        if (sourceError || !sourcePayment) return res.status(404).json({ error: 'Pago origen no encontrado' });
        if (sourcePayment.type !== 'ADVANCE_PAYMENT') return res.status(400).json({ error: 'Solo se pueden transferir pagos a cuenta (ADVANCE_PAYMENT)' });

        const transferId = crypto.randomUUID();
        const { data: transfer, error: transferError } = await supabase
            .from('Payment')
            .insert([{ id: transferId, patientId, amount: parseFloat(amount), method: 'wallet', type: 'TRANSFER', sourcePaymentId, treatmentId: treatmentId || null, budgetId: budgetId || null, doctorId, notes: notes || `Transferencia de anticipo a: ${treatmentName || 'Tratamiento'}`, createdAt: new Date().toISOString() }])
            .select().single();

        if (transferError) return res.status(500).json({ error: transferError.message });

        await calculateWalletBalance(supabase, patientId);

        if (treatmentId) {
            const { data: treatmentData } = await supabase.from('PatientTreatment').update({ status: 'PAGADO' }).eq('id', treatmentId).select().single();
            if (treatmentData && treatmentData.serviceId) {
                try {
                    const existingLiquidation = await prisma.liquidation.findFirst({
                        where: { appointment: { patientId, treatmentId: treatmentData.serviceId }, status: 'PENDING' },
                        orderBy: { createdAt: 'desc' }
                    });

                    if (existingLiquidation) {
                        await prisma.liquidation.update({ where: { id: existingLiquidation.id }, data: { doctorId } });
                    } else {
                        const dummyAppt = await prisma.appointment.create({
                            data: { date: new Date(), time: '00:00', status: 'COMPLETED', patientId, doctorId, treatmentId: treatmentData.serviceId },
                            include: { treatment: true, doctor: true }
                        });
                        await financeService.calculateLiquidation(prisma, dummyAppt);
                    }
                } catch (liqErr) {
                    console.error('⚠️ Error syncing liquidation on transfer:', liqErr);
                }
            }
        }

        res.json({ success: true, transfer, message: 'Saldo transferido correctamente. No se ha generado nueva factura.' });
    } catch (e) {
        console.error('❌ Transfer error:', e);
        res.status(500).json({ error: e.message });
    }
});

// ─── PAY WITH WALLET ──────────────────────────────────────────────────────────
router.post('/pay-with-wallet', async (req, res) => {
    try {
        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }

        const { patientId, amount, appointmentId, treatmentName, treatmentIds, budgetId } = req.body;
        if (!patientId || !amount) return res.status(400).json({ error: 'patientId and amount are required' });

        const numericAmount = parseFloat(amount);
        const { data: patient } = await supabase.from('Patient').select('wallet').eq('id', patientId).single();
        if (!patient) return res.status(404).json({ error: 'Patient not found' });
        if ((patient.wallet || 0) < numericAmount) return res.status(400).json({ error: 'Saldo insuficiente en monedero' });

        const result = await prisma.$transaction(async (tx) => {
            const payment = await tx.payment.create({
                data: { id: crypto.randomUUID(), patientId, amount: numericAmount, method: 'wallet', type: 'DIRECT_CHARGE', notes: `Pago con saldo: ${treatmentName || 'Tratamiento'}`, createdAt: new Date().toISOString() }
            });
            if (appointmentId) {
                await tx.appointment.update({ where: { id: appointmentId }, data: { paid: true, status: 'Completed' } });
            }
            await tx.patient.update({ where: { id: patientId }, data: { wallet: { decrement: numericAmount } } });
            return payment;
        });

        // Mark the paid PatientTreatment rows as COMPLETADO
        if (Array.isArray(treatmentIds) && treatmentIds.length > 0) {
            await supabase
                .from('PatientTreatment')
                .update({ status: 'COMPLETADO' })
                .in('id', treatmentIds)
                .eq('patientId', patientId);
        }

        // Also update the linked appointment's PatientTreatment via serviceId (fallback)
        if (appointmentId && !(Array.isArray(treatmentIds) && treatmentIds.length > 0)) {
            const { data: appt } = await supabase
                .from('Appointment')
                .select('treatmentId')
                .eq('id', appointmentId)
                .single();
            if (appt?.treatmentId) {
                await supabase
                    .from('PatientTreatment')
                    .update({ status: 'COMPLETADO' })
                    .eq('serviceId', appt.treatmentId)
                    .eq('patientId', patientId)
                    .not('status', 'in', '("COMPLETADO","PAGADO")');
            }
        }

        // Mark matched BudgetLineItems as paid so they disappear from the budget view
        await markBudgetLineItemsPaid(supabase, { budgetId, treatmentIds, treatmentName, appointmentId });

        // ── Create Liquidation for the doctor via ensureLiquidation ─────────
        // Uses the central service for idempotent upsert — no duplicates possible.
        if (appointmentId) {
            try {
                const { data: apptRow } = await supabase
                    .from('Appointment')
                    .select('doctorId, date, patient:Patient(name)')
                    .eq('id', appointmentId)
                    .single();

                if (apptRow?.doctorId) {
                    const { ensureLiquidation } = require('../services/liquidationService');
                    await ensureLiquidation(supabase, {
                        paymentId:     result.id,
                        appointmentId,
                        doctorId:      apptRow.doctorId,
                        grossAmount:   numericAmount,
                        labCost:       0,
                        treatmentName: treatmentName || 'Pago con saldo',
                        patientName:   apptRow.patient?.name || 'Paciente',
                        paymentMethod: 'wallet',
                        // Use appointment date so the row lands in the correct month
                        createdAt: apptRow.date
                            ? new Date(apptRow.date).toISOString().replace('T00:00:00.000Z', 'T12:00:00.000Z')
                            : new Date().toISOString(),
                    });
                }
            } catch (liqErr) {
                // Non-fatal: wallet payment already processed; log for reconciliation
                console.error('⚠️  pay-with-wallet: could not create liquidation:', liqErr.message);
            }
        }

        const newBalance = (patient.wallet || 0) - numericAmount;
        res.json({ success: true, payment: result, newBalance });
    } catch (e) {
        console.error('❌ Pay with wallet error:', e);
        res.status(500).json({ error: e.message });
    }
});

// ─── EXPENSES ─────────────────────────────────────────────────────────────────
router.get('/expenses', async (req, res) => {
    try {
        const supabase = getSupabase();
        const { month } = req.query;
        let query = supabase.from('expenses').select('*').order('date', { ascending: false });
        if (month) { query = query.gte('date', `${month}-01`).lte('date', `${month}-31`); }
        const { data, error } = await query;
        if (error) throw error;
        res.json(data || []);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/expenses', async (req, res) => {
    try {
        const supabase = getSupabase();
        const { date, description, category, amount, paymentMethod, receiptUrl } = req.body;
        if (!description || !category || !amount || !paymentMethod) {
            return res.status(400).json({ error: 'Faltan campos obligatorios: description, category, amount, paymentMethod' });
        }
        const { data, error } = await supabase.from('expenses').insert([{ date, description, category, amount, paymentMethod, receiptUrl }]).select().single();
        if (error) throw error;
        res.status(201).json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.put('/expenses/:id', async (req, res) => {
    try {
        const supabase = getSupabase();
        const { date, description, category, amount, paymentMethod, receiptUrl } = req.body;
        const { data, error } = await supabase.from('expenses').update({ date, description, category, amount, paymentMethod, receiptUrl }).eq('id', req.params.id).select().single();
        if (error) throw error;
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/expenses/:id', async (req, res) => {
    try {
        const supabase = getSupabase();
        const { error } = await supabase.from('expenses').delete().eq('id', req.params.id);
        if (error) throw error;
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── PAYMENTS: EDIT (amount + date + method + notes) ─────────────────────────
// Used by recepción to correct historical partial payment records.
// Also updates the linked Invoice amount/date to keep them in sync.
router.put('/payments/:id', async (req, res) => {
    try {
        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }

        const { id } = req.params;
        const { amount, createdAt, method, notes, doctorId } = req.body;

        if (!id) return res.status(400).json({ error: 'Payment ID is required' });

        // Validate amount if provided
        const numericAmount = amount !== undefined ? parseFloat(amount) : undefined;
        if (numericAmount !== undefined && (isNaN(numericAmount) || numericAmount <= 0)) {
            return res.status(400).json({ error: 'amount must be a positive number' });
        }

        // Validate and parse date if provided
        let isoDate;
        if (createdAt) {
            const parsed = new Date(createdAt);
            if (isNaN(parsed.getTime())) return res.status(400).json({ error: 'Invalid createdAt date' });
            isoDate = parsed.toISOString();
        }

        // Build Payment update payload (only include fields that were sent)
        const paymentUpdate = {};
        if (numericAmount !== undefined) paymentUpdate.amount = numericAmount;
        if (isoDate) paymentUpdate.createdAt = isoDate;
        if (method) paymentUpdate.method = method;
        if (notes !== undefined) paymentUpdate.notes = notes || null;
        // doctorId: null removes assignment; a string reassigns to another doctor
        if (doctorId !== undefined) paymentUpdate.doctorId = doctorId || null;

        if (Object.keys(paymentUpdate).length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        // Fetch existing payment to get invoiceId
        const { data: existing, error: fetchErr } = await supabase
            .from('Payment').select('id, invoiceId, amount').eq('id', id).single();
        if (fetchErr || !existing) return res.status(404).json({ error: 'Payment not found' });

        // Update Payment
        const { data: updatedPayment, error: pmtErr } = await supabase
            .from('Payment').update(paymentUpdate).eq('id', id).select().single();
        if (pmtErr) return res.status(500).json({ error: pmtErr.message });

        // Update linked Invoice (amount + date) if one exists
        let updatedInvoice = null;
        if (existing.invoiceId) {
            const invoiceUpdate = {};
            if (numericAmount !== undefined) invoiceUpdate.amount = numericAmount;
            if (isoDate) invoiceUpdate.date = isoDate;

            if (Object.keys(invoiceUpdate).length > 0) {
                const { data: inv, error: invErr } = await supabase
                    .from('Invoice').update(invoiceUpdate).eq('id', existing.invoiceId).select().single();
                if (!invErr) {
                    updatedInvoice = inv;
                    // Also update the InvoiceItem price to keep PDF/reports consistent
                    if (numericAmount !== undefined) {
                        await supabase
                            .from('InvoiceItem').update({ price: numericAmount }).eq('invoiceId', existing.invoiceId);
                    }
                }
            }
        }

        res.json({ success: true, payment: updatedPayment, invoice: updatedInvoice });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── CAJA: Patient cash history ───────────────────────────────────────────────
router.get('/caja/:patientId', async (req, res) => {
    try {
        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }

        const { patientId } = req.params;

        const { data: payments, error: pmtErr } = await supabase
            .from('Payment')
            .select('*')
            .eq('patientId', patientId)
            .order('createdAt', { ascending: false });

        if (pmtErr) return res.status(500).json({ error: pmtErr.message });

        const doctorIds = [...new Set((payments || []).map(p => p.doctorId).filter(Boolean))];
        const doctorMap = {};
        if (doctorIds.length > 0) {
            const { data: doctors } = await supabase.from('Doctor').select('id, name').in('id', doctorIds);
            (doctors || []).forEach(d => { doctorMap[d.id] = d.name; });
        }

        const { data: invoices } = await supabase
            .from('Invoice')
            .select('id, invoiceNumber, amount, date, status, paymentMethod, concept, relatedPaymentId')
            .eq('patientId', patientId)
            .order('date', { ascending: false });

        const invoiceByPaymentId = {};
        (invoices || []).forEach(inv => {
            if (inv.relatedPaymentId) invoiceByPaymentId[inv.relatedPaymentId] = inv;
        });

        const result = (payments || []).map(p => ({
            id: p.id,
            fecha: p.createdAt,
            doctorId: p.doctorId || null,
            doctorName: p.doctorId ? (doctorMap[p.doctorId] || 'Doctor no asignado') : 'Administración',
            concepto: p.notes || 'Pago',
            importe: p.amount,
            metodo: p.method,
            tipo: p.type,
            facturaNumero: invoiceByPaymentId[p.id]?.invoiceNumber || null,
            facturaEstado: invoiceByPaymentId[p.id]?.status || null,
        }));

        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── CASH REGISTER: Last closing before today (for openingCash / arrastre) ──
router.get('/cash-register/last-closing', async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const closing = await prisma.$queryRawUnsafe(
            `SELECT * FROM cash_register_closings WHERE date < $1 ORDER BY date DESC LIMIT 1`,
            today
        );
        const record = Array.isArray(closing) && closing.length > 0 ? closing[0] : null;
        res.json(record);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── CASH REGISTER: Today's closing status ───────────────────────────────────
router.get('/cash-register/today', async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const closing = await prisma.$queryRawUnsafe(
            `SELECT * FROM cash_register_closings WHERE date = $1 LIMIT 1`,
            today
        );
        const record = Array.isArray(closing) && closing.length > 0 ? closing[0] : null;
        res.json(record);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/cash-register/by-date/:date', async (req, res) => {
    try {
        const { date } = req.params;
        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return res.status(400).json({ error: 'Invalid date format, expected YYYY-MM-DD' });
        }
        const closing = await prisma.$queryRawUnsafe(
            `SELECT * FROM cash_register_closings WHERE date = $1 LIMIT 1`,
            date
        );
        const record = Array.isArray(closing) && closing.length > 0 ? closing[0] : null;
        res.json(record);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── CASH REGISTER: Most recent closing strictly before a given date ──────────
// Usado para calcular el arrastre de días pasados aunque haya huecos (festivos, fines de semana)
router.get('/cash-register/last-closing-before/:date', async (req, res) => {
    try {
        const { date } = req.params;
        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return res.status(400).json({ error: 'Invalid date format, expected YYYY-MM-DD' });
        }
        const closing = await prisma.$queryRawUnsafe(
            `SELECT * FROM cash_register_closings WHERE date < $1 ORDER BY date DESC LIMIT 1`,
            date
        );
        const record = Array.isArray(closing) && closing.length > 0 ? closing[0] : null;
        res.json(record);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── CASH REGISTER: Close the day ────────────────────────────────────────────
router.post('/cash-register/close', async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];

        // Allow closing a past date retroactively (e.g. forgot to close yesterday)
        const requestedDate = req.body.date;
        const closeDate = (requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) && requestedDate <= today)
            ? requestedDate
            : today;

        const existing = await prisma.$queryRawUnsafe(
            `SELECT id FROM cash_register_closings WHERE date = $1 LIMIT 1`,
            closeDate
        );
        if (Array.isArray(existing) && existing.length > 0) {
            return res.status(409).json({ error: `La caja del ${closeDate} ya fue cerrada.` });
        }

        const {
            totalIncome = 0, totalExpense = 0, balance = 0,
            cashIncome = 0, cardIncome = 0, transferIncome = 0,
            cashExpenses = 0, netCash = 0, physicalCash = 0,
            cashDiff = 0, invoiceCount = 0, completedAppointments = 0,
            openingCash = 0,
            closedBy = null
        } = req.body;

        // Validate openingCash against last closing to detect stale or corrupted arrastre
        try {
            const lastClosingRows = await prisma.$queryRawUnsafe(
                `SELECT "physicalCash" FROM cash_register_closings WHERE date < $1 ORDER BY date DESC LIMIT 1`,
                closeDate
            );
            const lastPhysical = Array.isArray(lastClosingRows) && lastClosingRows.length > 0
                ? Number(lastClosingRows[0].physicalCash)
                : null;
            if (lastPhysical !== null && Math.abs(openingCash - lastPhysical) > 10) {
                console.warn(
                    `[Caja] DISCREPANCIA de arrastre al cerrar ${closeDate}: ` +
                    `frontend envió openingCash=${openingCash}€ pero último physicalCash en BD=${lastPhysical}€. ` +
                    `Diferencia: ${Math.abs(openingCash - lastPhysical).toFixed(2)}€. ` +
                    `Guardando igualmente el valor enviado por el frontend.`
                );
            }
        } catch (warnErr) {
            console.warn('[Caja] No se pudo validar el arrastre antes del cierre:', warnErr.message);
        }

        const id = require('crypto').randomUUID();
        await prisma.$executeRawUnsafe(
            `INSERT INTO cash_register_closings
             (id, date, "closedAt", "closedBy", "totalIncome", "totalExpense", balance,
              "cashIncome", "cardIncome", "transferIncome", "cashExpenses", "netCash",
              "physicalCash", "cashDiff", "invoiceCount", "completedAppointments", "openingCash")
             VALUES ($1,$2,NOW(),$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
            id, closeDate, closedBy,
            totalIncome, totalExpense, balance,
            cashIncome, cardIncome, transferIncome,
            cashExpenses, netCash, physicalCash, cashDiff,
            invoiceCount, completedAppointments, openingCash
        );

        const record = await prisma.$queryRawUnsafe(
            `SELECT * FROM cash_register_closings WHERE id = $1`,
            id
        );
        res.status(201).json(Array.isArray(record) ? record[0] : record);
    } catch (e) {
        console.error('Error closing cash register:', e);
        res.status(500).json({ error: e.message });
    }
});

// ─── REFERRAL COMMISSIONS ─────────────────────────────────────────────────────
// GET /referral-commissions?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD
// Returns commissions grouped by referral entity, so the clinic knows what to pay out.
router.get('/referral-commissions', async (req, res) => {
    try {
        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }

        const { dateFrom, dateTo } = req.query;
        let query = supabase
            .from('Payment')
            .select('id, createdAt, amount, referralCommission, referralEntityName, patientId, notes')
            .gt('referralCommission', 0)
            .order('createdAt', { ascending: false });

        if (dateFrom) query = query.gte('createdAt', new Date(dateFrom).toISOString());
        if (dateTo) {
            const end = new Date(dateTo); end.setHours(23, 59, 59, 999);
            query = query.lte('createdAt', end.toISOString());
        }

        const { data: payments, error } = await query;
        if (error) return res.status(500).json({ error: error.message });

        // Enrich with patient names
        const patientIds = [...new Set((payments || []).map(p => p.patientId).filter(Boolean))];
        let patientMap = {};
        if (patientIds.length > 0) {
            const { data: patients } = await supabase.from('Patient').select('id, name, historyNumber').in('id', patientIds);
            (patients || []).forEach(pt => { patientMap[pt.id] = pt; });
        }

        // Group by referralEntityName
        const grouped = {};
        for (const p of (payments || [])) {
            const entity = p.referralEntityName || 'Sin empresa';
            if (!grouped[entity]) grouped[entity] = { entity, totalCommission: 0, payments: [] };
            const patient = patientMap[p.patientId] || {};
            grouped[entity].totalCommission += Number(p.referralCommission) || 0;
            grouped[entity].payments.push({
                id: p.id,
                date: p.createdAt,
                patientName: patient.name || 'Desconocido',
                historyNumber: patient.historyNumber || '—',
                totalPaid: p.amount,
                commission: p.referralCommission,
            });
        }

        const result = Object.values(grouped).sort((a, b) => b.totalCommission - a.totalCommission);
        const grandTotal = result.reduce((s, g) => s + g.totalCommission, 0);
        res.json({ groups: result, grandTotal });
    } catch (e) {
        console.error('Error fetching referral commissions:', e);
        res.status(500).json({ error: e.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// RECONCILIATION — detect paid appointments with no Liquidation record
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/finance/reconciliation
 * Returns all paid appointments that have no corresponding Liquidation.
 * Query params (all optional):
 *   month   — e.g. 4
 *   year    — e.g. 2026
 *   doctorId — filter by doctor
 */
router.get('/reconciliation', async (req, res) => {
    try {
        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }

        const { month, year, doctorId } = req.query;

        let query = supabase
            .from('Appointment')
            .select('id, date, amount, treatmentName, doctorId, doctor:Doctor(id, name), patient:Patient(id, name, historyNumber)')
            .eq('paid', true)
            .is('deleted_at', null)
            .gt('amount', 0);

        if (doctorId) query = query.eq('doctorId', doctorId);

        if (month && year) {
            const m = parseInt(month, 10);
            const y = parseInt(year, 10);
            const from = new Date(y, m - 1, 1).toISOString().substring(0, 10);
            const to   = new Date(y, m, 0).toISOString().substring(0, 10);
            query = query.gte('date', from).lte('date', to);
        }

        const { data: appointments, error } = await query.order('date', { ascending: false });
        if (error) throw error;

        if (!appointments || appointments.length === 0) {
            return res.json({ gaps: [] });
        }

        // Find which ones have no Liquidation
        const apptIds = appointments.map(a => a.id);
        const { data: existingLiqs } = await supabase
            .from('Liquidation')
            .select('appointmentId')
            .in('appointmentId', apptIds);

        const coveredIds = new Set((existingLiqs || []).map(l => l.appointmentId));
        const gaps = appointments
            .filter(a => !coveredIds.has(a.id))
            .map(a => ({
                appointmentId: a.id,
                date: a.date,
                amount: a.amount,
                treatmentName: a.treatmentName || 'Sin concepto',
                doctorId: a.doctorId,
                doctorName: a.doctor?.name || 'Sin doctor',
                patientName: a.patient?.name || 'Desconocido',
                historyNumber: a.patient?.historyNumber || '-'
            }));

        res.json({ gaps, total: gaps.length });
    } catch (e) {
        console.error('Error in reconciliation:', e);
        res.status(500).json({ error: e.message });
    }
});

/**
 * POST /api/finance/reconciliation/fix
 * Creates a missing Liquidation for a given appointmentId.
 * Body: { appointmentId }
 */
router.post('/reconciliation/fix', async (req, res) => {
    try {
        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }

        const { appointmentId } = req.body;
        if (!appointmentId) return res.status(400).json({ error: 'appointmentId is required' });

        // Load appointment + doctor + patient
        const { data: appt, error: apptErr } = await supabase
            .from('Appointment')
            .select('*, doctor:Doctor(*), patient:Patient(*)')
            .eq('id', appointmentId)
            .single();
        if (apptErr || !appt) return res.status(404).json({ error: 'Appointment not found' });
        if (!appt.doctorId) return res.status(400).json({ error: 'Appointment has no doctorId — assign a doctor first' });
        if (!appt.paid || !appt.amount) return res.status(400).json({ error: 'Appointment is not paid or has no amount' });

        // Guard: don't create if one already exists
        const { data: existing } = await supabase
            .from('Liquidation')
            .select('id')
            .eq('appointmentId', appointmentId)
            .single();
        if (existing) return res.status(409).json({ error: 'Liquidation already exists for this appointment', liquidationId: existing.id });

        const doctor = appt.doctor;
        const patient = appt.patient;
        const commissionRate = doctor?.commissionPercentage || 30;
        const grossAmount = parseFloat(appt.amount);
        const finalAmount = grossAmount * (commissionRate / 100);

        // Get paymentMethod from invoice if available
        const { data: inv } = await supabase
            .from('Invoice')
            .select('paymentMethod')
            .eq('appointmentId', appointmentId)
            .single();

        const { data: newLiq, error: liqErr } = await supabase
            .from('Liquidation')
            .insert({
                id: crypto.randomUUID(),
                doctorId: appt.doctorId,
                appointmentId,
                grossAmount,
                baseAmount: grossAmount,
                labCost: 0,
                commissionRate,
                finalAmount,
                treatmentName: appt.treatmentName || 'Tratamiento',
                patientName: patient?.name || 'Desconocido',
                paymentMethod: inv?.paymentMethod || 'cash',
                status: 'PENDING',
                createdAt: new Date(appt.date).toISOString().replace('T00:00:00.000Z', 'T12:00:00.000Z')
            })
            .select()
            .single();

        if (liqErr) throw liqErr;

        res.json({ success: true, liquidation: newLiq });
    } catch (e) {
        console.error('Error in reconciliation/fix:', e);
        res.status(500).json({ error: e.message });
    }
});

// ─── ADMIN: Manual reconciliation trigger ─────────────────────────────────────
// POST /api/finance/admin/reconcile-liquidations
// Requires JWT role = admin or manager.
// Body (optional): { lookbackDays: 180 }
router.post('/admin/reconcile-liquidations', async (req, res) => {
    try {
        const role = req.user?.role;
        if (role !== 'admin' && role !== 'manager') {
            return res.status(403).json({ error: 'Acceso denegado: se requiere rol admin o manager' });
        }
        const { runReconciliation } = require('../jobs/reconcileLiquidations');
        const lookbackDays = req.body?.lookbackDays ? parseInt(req.body.lookbackDays, 10) : 180;
        const result = await runReconciliation({ lookbackDays });
        res.json({ success: true, ...result });
    } catch (e) {
        console.error('[ADMIN reconcile] Error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
