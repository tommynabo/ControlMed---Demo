'use strict';
const express = require('express');
const crypto = require('crypto');
const { prisma, getSupabase } = require('../lib/db');
const { normalizePatient, calculateWalletBalance } = require('../lib/utils');
const { logAudit } = require('../lib/audit');
const gmailService = require('../services/gmailService');

const router = express.Router();

const ALLOWED_PATIENT_COLUMNS = [
    'name', 'firstName', 'lastName1', 'lastName2', 'dni', 'birthDate',
    'email', 'phone', 'insurance', 'assignedDoctorId', 'balance', 'wallet',
    'allergies', 'smoker', 'diseases', 'medications', 'criticalAlerts',
    'prescriptions', 'medicalHistory', 'historyNumber', 'isODA'
];

// ─── GET all patients ─────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
    try {
        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }

        const { page, limit, search } = req.query;
        const isPaginated = page !== undefined && limit !== undefined;

        let query = supabase
            .from('Patient')
            .select('*', isPaginated ? { count: 'exact' } : undefined)
            .order('name', { ascending: true });

        if (search) {
            const safe = String(search).replace(/[%_]/g, '\\$&').slice(0, 100);
            query = query.or(`name.ilike.%${safe}%,dni.ilike.%${safe}%`);
        }

        if (isPaginated) {
            const pageNum = Math.max(1, parseInt(page)) - 1;
            const limitNum = Math.min(200, Math.max(1, parseInt(limit)));
            const from = pageNum * limitNum;
            const to = from + limitNum - 1;
            query = query.range(from, to);
        }

        const { data, error, count } = await query;

        if (error) {
            console.error('❌ Supabase Fetch Error (Patients):', error);
            return res.status(500).json({ error: error.message });
        }

        const normalized = data.map(normalizePatient);

        if (isPaginated) {
            return res.json({ data: normalized, total: count, page: parseInt(page), limit: parseInt(limit) });
        }

        res.json(normalized);
    } catch (e) {
        console.error('Error fetching patients:', e);
        res.status(500).json({ error: e.message });
    }
});

// ─── GET single patient ───────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
    try {
        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }

        const { data, error } = await supabase
            .from('Patient').select('*').eq('id', req.params.id).single();

        if (error) return res.status(404).json({ error: error.message });
        res.json(normalizePatient(data));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── POST create patient ──────────────────────────────────────────────────────
router.post('/', async (req, res) => {
    try {
        const data = { ...req.body };

        const isValidUuid = (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
        if (!data.id || !isValidUuid(data.id)) data.id = crypto.randomUUID();

        const { firstName, lastName1, birthDate } = data;
        if (!firstName) return res.status(400).json({ error: 'Falta rellenar el campo: Nombre' });
        if (!lastName1) return res.status(400).json({ error: 'Falta rellenar el campo: Primer Apellido' });
        if (!data.dni) data.dni = `SIN-DNI-${crypto.randomUUID()}`;
        if (!birthDate) return res.status(400).json({ error: 'Falta rellenar el campo: Fecha de Nacimiento' });

        data.birthDate = new Date(birthDate).toISOString();
        data.name = `${firstName} ${lastName1} ${data.lastName2 || ''}`.trim();

        if (Array.isArray(data.prescriptions)) data.prescriptions = JSON.stringify(data.prescriptions);
        if (Array.isArray(data.medicalHistory)) data.medicalHistory = JSON.stringify(data.medicalHistory);
        if (Array.isArray(data.criticalAlerts)) data.criticalAlerts = JSON.stringify(data.criticalAlerts);

        let created;
        if (!data.historyNumber) {
            created = await prisma.$transaction(async (tx) => {
                // Scan ALL patients with any historyNumber to find the global maximum,
                // regardless of format (HC-0350, HCL-0350, bare "350", "0350", etc.)
                const allNums = await tx.patient.findMany({
                    where: { historyNumber: { not: null } },
                    select: { historyNumber: true }
                });
                let next = 1;
                if (allNums.length > 0) {
                    const max = allNums.reduce((best, p) => {
                        // Matches: HC-0350, HCL-0350, 0350, 350
                        const m = p.historyNumber.match(/(?:HC-|HCL-)?0*(\d+)/);
                        if (!m) return best;
                        const n = parseInt(m[1], 10);
                        return n > best ? n : best;
                    }, 0);
                    if (max > 0) next = max + 1;
                }
                data.historyNumber = `HC-${String(next).padStart(4, '0')}`;
                return tx.patient.create({ data });
            });
        } else {
            created = await prisma.patient.create({ data });
        }

        res.json(normalizePatient(created));

        // Audit log (fire-and-forget, never throws)
        try {
            const supabase = getSupabase();
            logAudit(supabase, { userId: req.user?.id, userRole: req.user?.role, action: 'CREATE', resourceType: 'patients', resourceId: created.id, newValues: { name: created.name, historyNumber: created.historyNumber }, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
        } catch (_) {}
    } catch (e) {
        console.error('Error creating patient:', e);
        if (e.code === 'P2002') {
            const target = e.meta?.target || [];
            if (target.includes('dni')) return res.status(400).json({ error: 'DNI ya existe.' });
            if (target.includes('historyNumber')) return res.status(400).json({ error: 'Número de historial ya existe.' });
        }
        res.status(500).json({ error: e.message });
    }
});

// ─── PUT update patient ───────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = { ...req.body };

        delete updates.id;
        delete updates.createdAt;

        if (updates.birthDate) updates.birthDate = new Date(updates.birthDate).toISOString();

        if (updates.firstName || updates.lastName1 || updates.lastName2) {
            updates.name = `${updates.firstName || ''} ${updates.lastName1 || ''} ${updates.lastName2 || ''}`.trim();
        }

        if (Array.isArray(updates.prescriptions)) updates.prescriptions = JSON.stringify(updates.prescriptions);
        if (Array.isArray(updates.medicalHistory)) updates.medicalHistory = JSON.stringify(updates.medicalHistory);
        if (Array.isArray(updates.criticalAlerts)) updates.criticalAlerts = JSON.stringify(updates.criticalAlerts);

        const sanitized = {};
        for (const key of ALLOWED_PATIENT_COLUMNS) {
            if (updates[key] !== undefined) sanitized[key] = updates[key];
        }

        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }

        const { data, error } = await supabase
            .from('Patient').update(sanitized).eq('id', id).select().single();

        if (error) {
            console.error('❌ Supabase Update Error:', error);
            return res.status(500).json({ error: error.message });
        }

        res.json(normalizePatient(data));

        // Audit log (fire-and-forget, never throws)
        try {
            logAudit(supabase, { userId: req.user?.id, userRole: req.user?.role, action: 'UPDATE', resourceType: 'patients', resourceId: id, newValues: sanitized, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
        } catch (_) {}
    } catch (e) {
        console.error('Error updating patient:', e);
        if (e.code === 'P2002' && e.meta?.target?.includes('dni')) {
            return res.status(400).json({ error: 'DNI ya existe.' });
        }
        res.status(500).json({ error: e.message });
    }
});

// ─── GET patient payments ─────────────────────────────────────────────────────
router.get('/:patientId/payments', async (req, res) => {
    try {
        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }

        const { data, error } = await supabase
            .from('Payment')
            .select('*')
            .eq('patientId', req.params.patientId)
            .order('createdAt', { ascending: false });

        if (error) {
            console.error('❌ Error fetching payments:', error);
            return res.status(500).json({ error: error.message });
        }
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── GET advance balance ──────────────────────────────────────────────────────
router.get('/:patientId/advance-balance', async (req, res) => {
    try {
        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }

        const { patientId } = req.params;

        const [{ data: advances, error: advError }, { data: transfers, error: transError }] = await Promise.all([
            supabase.from('Payment').select('*').eq('patientId', patientId).eq('type', 'ADVANCE_PAYMENT').order('createdAt', { ascending: false }),
            supabase.from('Payment').select('*').eq('patientId', patientId).eq('type', 'TRANSFER')
        ]);

        if (advError) throw advError;
        if (transError) throw transError;

        const totalAdvanced   = (advances || []).reduce((s, p) => s + (p.amount || 0), 0);
        const totalTransferred = (transfers || []).reduce((s, p) => s + (p.amount || 0), 0);

        res.json({
            patientId,
            totalAdvanced,
            totalTransferred,
            availableBalance: totalAdvanced - totalTransferred,
            advances: (advances || []).map(a => ({ id: a.id, amount: a.amount, date: a.createdAt, invoiceId: a.invoiceId, notes: a.notes })),
            transfers: (transfers || []).map(t => ({ id: t.id, amount: t.amount, date: t.createdAt, treatmentId: t.treatmentId, doctorId: t.doctorId, notes: t.notes }))
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── GET simplified balance ───────────────────────────────────────────────────
router.get('/:patientId/balance', async (req, res) => {
    try {
        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }

        const { patientId } = req.params;

        const [{ data: advances, error: advError }, { data: transfers, error: transError }] = await Promise.all([
            supabase.from('Payment').select('amount').eq('patientId', patientId).eq('type', 'ADVANCE_PAYMENT'),
            supabase.from('Payment').select('amount').eq('patientId', patientId).eq('type', 'TRANSFER')
        ]);

        if (advError) throw advError;
        if (transError) throw transError;

        const totalAdvanced   = (advances || []).reduce((s, p) => s + (p.amount || 0), 0);
        const totalTransferred = (transfers || []).reduce((s, p) => s + (p.amount || 0), 0);

        res.json({ balance: parseFloat((totalAdvanced - totalTransferred).toFixed(2)) });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── CONSENTS ─────────────────────────────────────────────────────────────────
router.post('/:patientId/consents', async (req, res) => {
    try {
        const { patientId } = req.params;
        const { templateId, isSigned } = req.body;

        if (!patientId || !templateId) {
            return res.status(400).json({ error: 'patientId and templateId are required' });
        }

        const consent = await prisma.consent.create({
            data: {
                id: crypto.randomUUID(),
                patientId,
                templateId,
                title: 'Consentimiento',
                isSigned: isSigned || false,
                signedDate: isSigned ? new Date().toISOString() : null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        });

        res.json(consent);
    } catch (e) {
        console.error('Error creating consent:', e);
        res.status(500).json({ error: e.message });
    }
});

router.get('/:patientId/consents', async (req, res) => {
    try {
        const consents = await prisma.consent.findMany({
            where: { patientId: req.params.patientId },
            orderBy: { createdAt: 'desc' }
        });
        res.json(consents);
    } catch (e) {
        console.error('Error fetching consents:', e);
        res.status(500).json({ error: e.message });
    }
});

router.patch('/:patientId/consents/:consentId', async (req, res) => {
    try {
        const { consentId } = req.params;
        const { isSigned } = req.body;

        const consent = await prisma.consent.update({
            where: { id: consentId },
            data: {
                isSigned: isSigned || false,
                signedDate: isSigned ? new Date().toISOString() : null,
                updatedAt: new Date().toISOString()
            }
        });
        res.json(consent);

        // Gmail consent copy (fire-and-forget)
        if (isSigned) {
            (async () => {
                try {
                    const patient = await prisma.patient.findUnique({
                        where: { id: req.params.patientId },
                        select: { name: true, email: true }
                    });
                    if (!patient?.email) return;

                    const signedDate = new Date().toLocaleString('es-ES');
                    await gmailService.sendGmail({
                        to: patient.email,
                        subject: 'Copia de su consentimiento firmado',
                        htmlBody: `
                            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1e293b;">
                                <h2 style="color:#7c3aed;">Consentimiento Informado Firmado</h2>
                                <p>Estimado/a <strong>${patient.name}</strong>,</p>
                                <p>Le enviamos confirmaci&#243;n de que ha firmado su consentimiento informado en nuestra cl&#237;nica.</p>
                                <table style="width:100%;border-collapse:collapse;margin:20px 0;">
                                    <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;"><strong>Documento:</strong></td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">${consent.title}</td></tr>
                                    <tr><td style="padding:8px;"><strong>Fecha de firma:</strong></td><td style="padding:8px;">${signedDate}</td></tr>
                                </table>
                                <p style="color:#64748b;font-size:13px;">Guarde este correo como comprobante. Si tiene alguna pregunta, contacte con la cl&#237;nica.</p>
                            </div>`,
                    });
                    console.log(`📧 Consent copy sent to ${patient.email}`);
                } catch (mailErr) {
                    console.warn('⚠️ Email consent failed (non-critical):', mailErr.message);
                }
            })();
        }
    } catch (e) {
        console.error('Error updating consent:', e);
        res.status(500).json({ error: e.message });
    }
});

router.delete('/:patientId/consents/:consentId', async (req, res) => {
    try {
        await prisma.consent.delete({ where: { id: req.params.consentId } });
        res.json({ success: true });
    } catch (e) {
        console.error('Error deleting consent:', e);
        res.status(500).json({ error: e.message });
    }
});

// ─── DOCUMENTS ────────────────────────────────────────────────────────────────
router.get('/:patientId/documents', async (req, res) => {
    try {
        res.json([]);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/:patientId/documents', async (req, res) => {
    try {
        const { patientId } = req.params;
        const { fileName, documentType, description } = req.body;

        if (!patientId || !fileName || !documentType) {
            return res.status(400).json({ error: 'patientId, fileName, and documentType are required' });
        }

        const document = {
            id: crypto.randomUUID(),
            patientId,
            fileName,
            documentType,
            fileSize: 0,
            uploadDate: new Date().toISOString(),
            createdBy: 'System',
            description: description || null
        };

        res.status(201).json(document);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/:patientId/documents/:documentId', async (req, res) => {
    try {
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/:patientId/documents/:documentId/download', async (req, res) => {
    try {
        res.json({ message: 'Document download started' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
