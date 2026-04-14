'use strict';
const express = require('express');
const crypto = require('crypto');
const { prisma, getSupabase } = require('../lib/db');
const financeService = require('../services/financeService');
const { logAudit } = require('../lib/audit');
const { resolveUserNames } = require('../lib/utils');

const router = express.Router();

// ─── TREATMENTS: complete appointment ────────────────────────────────────────
router.post('/appointments/:appointmentId/complete', async (req, res) => {
    try {
        const { appointmentId } = req.params;
        let appointment;
        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }

        // Try Supabase first
        const { data: sbAppt } = await supabase
            .from('Appointment')
            .update({ status: 'Completed' })
            .eq('id', appointmentId)
            .select('*, treatment:Treatment(*), doctor:Doctor(*)')
            .single();

        if (sbAppt) {
            appointment = sbAppt;
        } else {
            appointment = await prisma.appointment.update({
                where: { id: appointmentId },
                data: { status: 'Completed' },
                include: { treatment: true, doctor: true }
            });
        }

        if (!appointment) return res.status(404).json({ error: 'Appointment not found' });

        await financeService.calculateLiquidation(prisma, appointment);
        res.json({ success: true, appointment });
    } catch (e) {
        console.error('Error completing treatment:', e);
        res.status(500).json({ error: e.message });
    }
});

// ─── PRESCRIPTIONS ────────────────────────────────────────────────────────────
router.get('/patients/:patientId/prescriptions', async (req, res) => {
    try {
        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }

        const { data, error } = await supabase
            .from('Prescription')
            .select('*')
            .eq('patientId', req.params.patientId)
            .order('date', { ascending: false });

        if (error) throw error;
        res.json(data || []);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/patients/:patientId/prescriptions', async (req, res) => {
    try {
        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }

        const payload = { ...req.body, id: crypto.randomUUID(), patientId: req.params.patientId };
        const { data, error } = await supabase.from('Prescription').insert([payload]).select().single();
        if (error) throw error;
        res.status(201).json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.put('/patients/:patientId/prescriptions/:id', async (req, res) => {
    try {
        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }

        const { data, error } = await supabase
            .from('Prescription').update(req.body).eq('id', req.params.id).select().single();
        if (error) throw error;
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/patients/:patientId/prescriptions/:id', async (req, res) => {
    try {
        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }

        const { error } = await supabase.from('Prescription').delete().eq('id', req.params.id);
        if (error) throw error;
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── TREATMENTS (patient treatments) ─────────────────────────────────────────
router.get('/patients/:patientId/treatments', async (req, res) => {
    try {
        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }

        const { data, error } = await supabase
            .from('PatientTreatment')
            .select('*, service:ServiceCatalog(*)')
            .eq('patientId', req.params.patientId)
            .order('createdAt', { ascending: false });

        if (error) throw error;

        // Enrich with user names
        const rows = data || [];
        const userIds = rows.map(t => t.updated_by).filter(Boolean);
        const nameMap = await resolveUserNames(supabase, userIds);
        const enriched = rows.map(t => ({ ...t, updated_by_name: t.updated_by ? (nameMap.get(t.updated_by) || null) : null }));

        res.json(enriched);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/patients/:patientId/treatments', async (req, res) => {
    try {
        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }

        const payload = { ...req.body, id: crypto.randomUUID(), patientId: req.params.patientId, updated_by: req.user?.id || null };
        const { data, error } = await supabase.from('PatientTreatment').insert([payload]).select().single();
        if (error) throw error;
        logAudit(supabase, { userId: req.user?.id, userRole: req.user?.role, action: 'CREATE', resourceType: 'treatments', resourceId: data.id, newValues: data, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
        res.status(201).json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.put('/patients/:patientId/treatments/:id', async (req, res) => {
    try {
        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }

        const { data: oldTreatment } = await supabase.from('PatientTreatment').select('*').eq('id', req.params.id).single();
        const { data, error } = await supabase
            .from('PatientTreatment').update({ ...req.body, updated_by: req.user?.id || null }).eq('id', req.params.id).select().single();
        if (error) throw error;
        logAudit(supabase, { userId: req.user?.id, userRole: req.user?.role, action: 'UPDATE', resourceType: 'treatments', resourceId: req.params.id, oldValues: oldTreatment || undefined, newValues: data, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/patients/:patientId/treatments/:id', async (req, res) => {
    try {
        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }

        const { data: oldT } = await supabase.from('PatientTreatment').select('*').eq('id', req.params.id).single();
        const { error } = await supabase.from('PatientTreatment').delete().eq('id', req.params.id);
        if (error) throw error;
        logAudit(supabase, { userId: req.user?.id, userRole: req.user?.role, action: 'DELETE', resourceType: 'treatments', resourceId: req.params.id, oldValues: oldT || undefined, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── CLINICAL RECORDS ─────────────────────────────────────────────────────────
router.get('/patients/:patientId/clinical-records', async (req, res) => {
    try {
        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }

        const { data, error } = await supabase
            .from('ClinicalRecord')
            .select('*')
            .eq('patientId', req.params.patientId)
            .is('deleted_at', null)
            .order('date', { ascending: false });

        if (error) return res.status(500).json({ error: error.message });

        // Enrich with user names
        const userIds = (data || []).map(r => r.updated_by).filter(Boolean);
        const nameMap = await resolveUserNames(supabase, userIds);

        const mapped = (data || []).map(record => {
            let parsed = {};
            let isJson = false;
            try {
                if (record.text && (record.text.startsWith('{') || record.text.startsWith('['))) {
                    parsed = JSON.parse(record.text);
                    isJson = true;
                }
            } catch (_) {}
            return {
                ...record,
                clinicalData: isJson ? parsed : { treatment: 'Nota', observation: record.text },
                specialization: isJson && parsed.specialization ? parsed.specialization : 'General',
                updated_by_name: record.updated_by ? (nameMap.get(record.updated_by) || null) : null,
            };
        });

        res.json(mapped);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/clinical-records', async (req, res) => {
    try {
        const { patientId, treatment, observation, specialization, price, doctorId } = req.body;

        if (!doctorId) return res.status(400).json({ error: 'Se requiere seleccionar un doctor responsable.' });

        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }

        const payload = {
            treatment: treatment || 'Nota Clínica',
            observation: observation || '',
            specialization: specialization || 'General',
            price: price || 0,
            doctorId
        };

        const { data, error } = await supabase
            .from('ClinicalRecord')
            .insert([{ id: crypto.randomUUID(), patientId, date: new Date().toISOString(), text: JSON.stringify(payload), authorId: doctorId, updated_by: req.user?.id || null }])
            .select()
            .single();

        if (error) return res.status(500).json({ error: error.message });
        logAudit(supabase, { userId: req.user?.id, userRole: req.user?.role, action: 'CREATE', resourceType: 'clinical_records', resourceId: data.id, newValues: payload, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
        res.status(201).json({ ...data, clinicalData: payload, specialization: payload.specialization });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.put('/clinical-records/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { treatment, observation, specialization, doctorId } = req.body;

        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }

        const { data: existing, error: fetchErr } = await supabase.from('ClinicalRecord').select('*').eq('id', id).single();
        if (fetchErr || !existing) return res.status(404).json({ error: 'Registro clínico no encontrado' });

        let parsed = {};
        try { parsed = JSON.parse(existing.text || '{}'); } catch (_) {}

        const updated = {
            treatment: treatment !== undefined ? treatment : (parsed.treatment || ''),
            observation: observation !== undefined ? observation : (parsed.observation || ''),
            specialization: specialization !== undefined ? specialization : (parsed.specialization || 'General'),
            price: parsed.price || 0,
            doctorId: doctorId || parsed.doctorId || existing.authorId
        };

        const { data, error } = await supabase
            .from('ClinicalRecord')
            .update({ text: JSON.stringify(updated), authorId: updated.doctorId, updated_by: req.user?.id || null })
            .eq('id', id).select().single();

        if (error) return res.status(500).json({ error: error.message });
        logAudit(supabase, { userId: req.user?.id, userRole: req.user?.role, action: 'UPDATE', resourceType: 'clinical_records', resourceId: id, oldValues: parsed, newValues: updated, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
        res.json({ ...data, clinicalData: updated, specialization: updated.specialization });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/clinical-records/:id', async (req, res) => {
    try {
        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }
        const { data: oldCR } = await supabase.from('ClinicalRecord').select('*').eq('id', req.params.id).single();
        const { error } = await supabase.from('ClinicalRecord').update({ deleted_at: new Date().toISOString() }).eq('id', req.params.id);
        if (error) throw error;
        logAudit(supabase, { userId: req.user?.id, userRole: req.user?.role, action: 'DELETE', resourceType: 'clinical_records', resourceId: req.params.id, oldValues: oldCR || undefined, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.put('/clinical-records/:recordId/reassign-doctor', async (req, res) => {
    try {
        const { recordId } = req.params;
        const { doctorId } = req.body;
        if (!doctorId) return res.status(400).json({ error: 'doctorId is required' });

        const record = await prisma.clinicalRecord.update({
            where: { id: recordId },
            data: { authorId: doctorId },
            include: { patient: true }
        });
        res.json({ success: true, message: `Registro clínico de ${record.patient.name} actualizado`, record });
    } catch (e) {
        console.error('Error reassigning doctor:', e);
        res.status(500).json({ error: e.message });
    }
});

// ─── BUDGETS ──────────────────────────────────────────────────────────────────
router.delete('/budgets/:id', async (req, res) => {
    try {
        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }
        const { error } = await supabase.from('Budget').update({ deleted_at: new Date().toISOString() }).eq('id', req.params.id);
        if (error) throw error;
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── ODONTOGRAM ───────────────────────────────────────────────────────────────
router.get('/patients/:patientId/odontogram', async (req, res) => {
    try {
        const o = await prisma.odontogram.findUnique({ where: { patientId: req.params.patientId } });
        res.json(o || { teethState: '{}' });
    } catch (e) {
        res.json({ teethState: '{}' });
    }
});

router.post('/patients/:patientId/odontogram', async (req, res) => {
    try {
        const { teethState } = req.body;
        const patient = await prisma.patient.findUnique({ where: { id: req.params.patientId } });
        if (!patient) return res.json({ patientId: req.params.patientId, teethState });

        const o = await prisma.odontogram.upsert({
            where:  { patientId: req.params.patientId },
            update: { teethState },
            create: { patientId: req.params.patientId, teethState }
        });
        res.json(o);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── SNAPSHOTS ────────────────────────────────────────────────────────────────
router.get('/patients/:patientId/snapshots', async (req, res) => {
    try {
        const list = await prisma.dentalSnapshot.findMany({
            where: { patientId: req.params.patientId },
            orderBy: { date: 'desc' }
        });
        res.json(list);
    } catch (e) {
        res.json([]);
    }
});

router.post('/patients/:patientId/snapshots', async (req, res) => {
    try {
        const { imageUrl, description } = req.body;
        const s = await prisma.dentalSnapshot.create({
            data: { patientId: req.params.patientId, imageUrl, description }
        });
        res.json(s);
    } catch (e) {
        res.json([]);
    }
});

// ─── CLINICAL PLANS ───────────────────────────────────────────────────────────
router.get('/clinical-plans/:patientId', async (req, res) => {
    try {
        const supabase = getSupabase();
        const { data: plans, error } = await supabase
            .from('clinical_treatment_plans')
            .select('*, steps:clinical_treatment_steps(*)')
            .eq('patientId', req.params.patientId)
            .order('createdAt', { ascending: false });

        if (error) throw error;
        const sorted = (plans || []).map(p => ({
            ...p,
            steps: (p.steps || []).sort((a, b) => a.stepOrder - b.stepOrder)
        }));
        res.json(sorted);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/clinical-plans', async (req, res) => {
    try {
        const supabase = getSupabase();
        const { patientId, name, notes, steps } = req.body;
        if (!patientId) return res.status(400).json({ error: 'patientId is required' });

        const planId = crypto.randomUUID();
        const { data: plan, error: planError } = await supabase
            .from('clinical_treatment_plans')
            .insert([{ id: planId, patientId, name: name || 'Plan de Tratamiento', status: 'ACTIVE', notes: notes || null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }])
            .select().single();

        if (planError) throw planError;
        logAudit(supabase, { userId: req.user?.id, userRole: req.user?.role, action: 'CREATE', resourceType: 'clinical_plans', resourceId: planId, newValues: { patientId, name }, ipAddress: req.ip, userAgent: req.headers['user-agent'] });

        if (steps && steps.length > 0) {
            const stepsToInsert = steps.map((s, idx) => ({
                id: crypto.randomUUID(), planId, stepOrder: idx,
                treatmentName: s.treatmentName || s.treatment_name,
                toothId: s.toothId || s.tooth_id || null,
                status: 'PENDIENTE', notes: s.notes || null, createdAt: new Date().toISOString()
            }));
            const { error: stepsError } = await supabase.from('clinical_treatment_steps').insert(stepsToInsert);
            if (stepsError) throw stepsError;
        }

        const { data: fullPlan } = await supabase
            .from('clinical_treatment_plans').select('*, steps:clinical_treatment_steps(*)').eq('id', planId).single();
        res.status(201).json(fullPlan);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.put('/clinical-plans/:id', async (req, res) => {
    try {
        const supabase = getSupabase();
        const { name, status, notes } = req.body;
        const updates = { updatedAt: new Date().toISOString() };
        if (name !== undefined) updates.name = name;
        if (status !== undefined) updates.status = status;
        if (notes !== undefined) updates.notes = notes;

        const { data, error } = await supabase
            .from('clinical_treatment_plans').update(updates).eq('id', req.params.id)
            .select('*, steps:clinical_treatment_steps(*)').single();
        if (error) throw error;
        logAudit(supabase, { userId: req.user?.id, userRole: req.user?.role, action: 'UPDATE', resourceType: 'clinical_plans', resourceId: req.params.id, newValues: updates, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/clinical-plans/:id', async (req, res) => {
    try {
        const supabase = getSupabase();
        const { error } = await supabase.from('clinical_treatment_plans').delete().eq('id', req.params.id);
        if (error) throw error;
        logAudit(supabase, { userId: req.user?.id, userRole: req.user?.role, action: 'DELETE', resourceType: 'clinical_plans', resourceId: req.params.id, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/clinical-plan-steps', async (req, res) => {
    try {
        const supabase = getSupabase();
        const { planId, treatmentName, toothId, notes, stepOrder } = req.body;
        if (!planId || !treatmentName) return res.status(400).json({ error: 'planId and treatmentName are required' });

        const { data: existing } = await supabase
            .from('clinical_treatment_steps').select('stepOrder').eq('planId', planId).order('stepOrder', { ascending: false }).limit(1);
        const maxOrder = existing && existing.length > 0 ? existing[0].stepOrder : -1;

        const { data, error } = await supabase
            .from('clinical_treatment_steps')
            .insert([{ id: crypto.randomUUID(), planId, stepOrder: stepOrder !== undefined ? stepOrder : maxOrder + 1, treatmentName, toothId: toothId || null, status: 'PENDIENTE', notes: notes || null, createdAt: new Date().toISOString() }])
            .select().single();
        if (error) throw error;
        res.status(201).json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.put('/clinical-plan-steps/:id', async (req, res) => {
    try {
        const supabase = getSupabase();
        const { status, stepOrder, treatmentName, notes, toothId } = req.body;
        const updates = {};
        if (status !== undefined) { updates.status = status; updates.completedAt = status === 'COMPLETADO' ? new Date().toISOString() : null; }
        if (stepOrder !== undefined) updates.stepOrder = stepOrder;
        if (treatmentName !== undefined) updates.treatmentName = treatmentName;
        if (notes !== undefined) updates.notes = notes;
        if (toothId !== undefined) updates.toothId = toothId;

        const { data, error } = await supabase.from('clinical_treatment_steps').update(updates).eq('id', req.params.id).select().single();
        if (error) throw error;
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/clinical-plan-steps/:id', async (req, res) => {
    try {
        const supabase = getSupabase();
        const { error } = await supabase.from('clinical_treatment_steps').delete().eq('id', req.params.id);
        if (error) throw error;
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
