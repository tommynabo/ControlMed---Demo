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

// ─── FINANCE: Financing plan ──────────────────────────────────────────────────
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

router.get('/liquidations/summary', async (req, res) => {
    try {
        const { doctorId, month, year, dateFrom, dateTo } = req.query;
        if (!doctorId) return res.status(400).json({ error: 'doctorId is required' });

        if (dateFrom && dateTo) {
            let supabase;
            try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }

            const startISO = new Date(dateFrom).toISOString();
            const endDate  = new Date(dateTo); endDate.setHours(23, 59, 59, 999);
            const endISO   = endDate.toISOString();

            const { data: payments, error: pmtError } = await supabase
                .from('Payment').select('*')
                .eq('doctorId', doctorId).gte('createdAt', startISO).lte('createdAt', endISO)
                .order('createdAt', { ascending: true });
            if (pmtError) throw pmtError;

            const patientIds = [...new Set((payments || []).map(p => p.patientId).filter(Boolean))];
            const patientMap = {};
            if (patientIds.length > 0) {
                const { data: patients } = await supabase.from('Patient').select('id, name, historyNumber').in('id', patientIds);
                (patients || []).forEach(pt => { patientMap[pt.id] = pt; });
            }

            const records = (payments || []).map(p => {
                const patient = patientMap[p.patientId] || {};
                return { id: p.id, fecha: p.createdAt, concepto: p.notes || 'Pago', importeCobrado: p.amount || 0, nombrePaciente: patient.name || 'Desconocido', numeroHistoria: patient.historyNumber || '-', doctorId: p.doctorId };
            });
            const total = records.reduce((s, r) => s + r.importeCobrado, 0);
            return res.json({ records, dateFrom, dateTo, doctorId, total });
        }

        const monthInt = parseInt(month, 10) || new Date().getMonth() + 1;
        const yearInt  = parseInt(year,  10) || new Date().getFullYear();
        const startDate = new Date(yearInt, monthInt - 1, 1);
        const endDate   = new Date(yearInt, monthInt, 0, 23, 59, 59);

        const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } });
        if (!doctor) return res.status(404).json({ error: 'Doctor not found' });

        let liquidations = [];
        try {
            liquidations = await prisma.liquidation.findMany({
                where: { doctorId, createdAt: { gte: startDate, lte: endDate } },
                orderBy: { createdAt: 'asc' }
            });
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
router.get('/invoices', async (req, res) => {
    try {
        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }

        const { data, error } = await supabase.from('Invoice').select('*, items:InvoiceItem(*)').order('date', { ascending: false });
        if (error) return res.status(500).json({ error: error.message });
        res.json(data);
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
router.post('/payments/create', async (req, res) => {
    try {
        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }

        const { patientId, amount, method, type, notes, appointmentId, budgetId, isPartial, originalAmount } = req.body;

        if (!patientId || !amount || !method) {
            return res.status(400).json({ error: 'patientId, amount, and method are required' });
        }

        const numericAmount = parseFloat(amount);
        if (isNaN(numericAmount) || numericAmount <= 0) {
            return res.status(400).json({ error: 'Invalid amount' });
        }

        // Resolve patient and doctor
        const { data: patient } = await supabase.from('Patient').select('*').eq('id', patientId).single();
        if (!patient) return res.status(404).json({ error: 'Patient not found' });

        let doctor = null;
        const doctorId = req.body.doctorId;
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

        // Attempt Quipu invoice creation
        let quipuResult = { success: false };
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
                quipuResult = await quipuService.createInvoice(
                    contact.id,
                    [{ name: solvedTreatmentName, quantity: 1, price: numericAmount }],
                    today, today,
                    method === 'card' ? 'credit_card' : method
                );
            }
        } catch (qErr) {
            console.error('⚠️ Quipu Error (continuing with local only):', qErr.response?.data || qErr.message);
        }

        const result = await prisma.$transaction(async (tx) => {
            const isPartialPayment = isPartial === true;

            const payment = await tx.payment.create({
                data: { id: crypto.randomUUID(), patientId, budgetId: budgetId || null, amount: numericAmount, method, type, notes: notes || null, doctorId: doctor?.id || null, createdAt: new Date().toISOString() }
            });

            if (appointmentId) {
                await tx.appointment.update({
                    where: { id: appointmentId },
                    data: isPartialPayment ? { paid: false, status: 'EN_PROCESO' } : { paid: true, status: 'Completed' }
                });
            }

            let invoiceNumber = quipuResult.success ? quipuResult.number : null;
            if (!invoiceNumber || invoiceNumber === 'PENDING') {
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
            }

            const invoice = await tx.invoice.create({
                data: {
                    id: crypto.randomUUID(), invoiceNumber,
                    externalId: quipuResult.success ? String(quipuResult.id) : null,
                    url: quipuResult.success ? quipuResult.pdf_url : null,
                    patientId, amount: numericAmount, date: new Date(), status: 'issued',
                    paymentMethod: method,
                    concept: isPartialPayment ? `${solvedTreatmentName} (Pago Parcial)` : solvedTreatmentName,
                    appointmentId: (appointmentId && !isPartialPayment) ? appointmentId : null,
                    relatedPaymentId: payment.id
                }
            });

            await tx.invoiceItem.create({ data: { id: crypto.randomUUID(), invoiceId: invoice.id, name: solvedTreatmentName, price: numericAmount } });
            await tx.payment.update({ where: { id: payment.id }, data: { invoiceId: invoice.id } });

            let liquidation = null;
            if (doctor && type === 'DIRECT_CHARGE') {
                const rawRate = doctor.commissionPercentage || 30;
                const labCost = req.body.costeLab || 0;
                const finalAmount = (numericAmount - labCost) * (rawRate / 100);
                liquidation = await tx.liquidation.create({
                    data: { id: crypto.randomUUID(), doctorId: doctor.id, appointmentId: (appointmentId && !isPartialPayment) ? appointmentId : null, grossAmount: numericAmount, labCost, commissionRate: rawRate, finalAmount, treatmentName: solvedTreatmentName, patientName: patient?.name || 'Paciente', paymentMethod: method, status: 'PENDING', createdAt: new Date().toISOString() }
                });
            }

            if (type === 'ADVANCE_PAYMENT' || (type === 'DIRECT_CHARGE' && method === 'wallet')) {
                const balanceAdjustment = method === 'wallet' ? -numericAmount : numericAmount;
                await tx.patient.update({ where: { id: patientId }, data: { wallet: { increment: balanceAdjustment } } });
            }

            return { payment, invoice, payroll: liquidation, pdfUrl: quipuResult.success ? quipuResult.pdf_url : null, previewUrl: quipuResult.success ? quipuResult.preview_url : null, isPartial: isPartial === true, remainingBalance: (isPartial && originalAmount) ? parseFloat(originalAmount) - numericAmount : 0 };
        });

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
                                <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;"><strong>Importe:</strong></td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">€${numericAmount.toFixed(2)}</td></tr>
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

// ─── PAYMENTS: TRANSFER advance to treatment ─────────────────────────────────
router.post('/payments/transfer', async (req, res) => {
    try {
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

        const { patientId, amount, appointmentId, treatmentName } = req.body;
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

        res.json({ success: true, payment: result });
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

// ─── CASH REGISTER: Close the day ────────────────────────────────────────────
router.post('/cash-register/close', async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const existing = await prisma.$queryRawUnsafe(
            `SELECT id FROM cash_register_closings WHERE date = $1 LIMIT 1`,
            today
        );
        if (Array.isArray(existing) && existing.length > 0) {
            return res.status(409).json({ error: 'La caja ya fue cerrada hoy.' });
        }

        const {
            totalIncome = 0, totalExpense = 0, balance = 0,
            cashIncome = 0, cardIncome = 0, transferIncome = 0,
            cashExpenses = 0, netCash = 0, physicalCash = 0,
            cashDiff = 0, invoiceCount = 0, completedAppointments = 0,
            closedBy = null
        } = req.body;

        const id = require('crypto').randomUUID();
        await prisma.$executeRawUnsafe(
            `INSERT INTO cash_register_closings
             (id, date, "closedAt", "closedBy", "totalIncome", "totalExpense", balance,
              "cashIncome", "cardIncome", "transferIncome", "cashExpenses", "netCash",
              "physicalCash", "cashDiff", "invoiceCount", "completedAppointments")
             VALUES ($1,$2,NOW(),$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
            id, today, closedBy,
            totalIncome, totalExpense, balance,
            cashIncome, cardIncome, transferIncome,
            cashExpenses, netCash, physicalCash, cashDiff,
            invoiceCount, completedAppointments
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

module.exports = router;
