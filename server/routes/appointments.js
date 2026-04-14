'use strict';
const express = require('express');
const crypto = require('crypto');
const { prisma, getSupabase } = require('../lib/db');
const { logAudit } = require('../lib/audit');
const { resolveUserNames } = require('../lib/utils');

const router = express.Router();

const isValidUUID = (s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

// ─── POST create appointment ──────────────────────────────────────────────────
router.post('/', async (req, res) => {
    try {
        const {
            date, time, patientId, doctorId, treatmentId, treatmentName,
            duration, observations, visitDetails, budgetId, budgetItemId,
            budgetItemIds, amount, isRevision, serviceIds
        } = req.body;

        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }

        const safeTreatmentId   = (treatmentId && isValidUUID(treatmentId)) ? treatmentId : null;
        const safeDoctorId      = (doctorId && doctorId !== 'undefined' && String(doctorId).trim()) ? doctorId : null;
        const safeBudgetId      = (budgetId && budgetId !== 'undefined' && String(budgetId).trim()) ? budgetId : null;
        const safeBudgetItemId  = (budgetItemId && budgetItemId !== 'undefined' && String(budgetItemId).trim()) ? budgetItemId : null;

        // Doctor existence check + auto-sync
        if (safeDoctorId) {
            const { data: doctor, error: doctorErr } = await supabase
                .from('Doctor').select().eq('id', safeDoctorId).maybeSingle();

            if (doctorErr) return res.status(400).json({ error: 'Error al validar doctor: ' + doctorErr.message });

            if (!doctor) {
                const { data: userDoc } = await supabase.from('User').select('id, name').eq('id', safeDoctorId).maybeSingle();
                if (userDoc) {
                    await supabase.from('Doctor').upsert({ id: userDoc.id, name: userDoc.name, specialization: 'Odontólogo' });
                } else {
                    const { data: userByDocId } = await supabase.from('User').select('id, name').eq('doctorId', safeDoctorId).maybeSingle();
                    if (userByDocId) {
                        await supabase.from('Doctor').upsert({ id: safeDoctorId, name: userByDocId.name, specialization: 'Odontólogo' });
                    } else {
                        return res.status(400).json({ error: `Doctor no encontrado (ID: ${safeDoctorId}).` });
                    }
                }
            } else if (doctor.is_active === false) {
                return res.status(400).json({ error: `El Dr. ${doctor.name} está inactivo.` });
            }
        }

        const appointmentId = crypto.randomUUID();

        let resolvedTreatmentName = treatmentName || null;
        if (Array.isArray(serviceIds) && serviceIds.length > 0) {
            try {
                const { data: svcs } = await supabase.from('services').select('id, name').in('id', serviceIds);
                if (svcs && svcs.length > 0) resolvedTreatmentName = svcs.map(s => s.name).join(', ');
            } catch (_) {}
        }

        const { data, error } = await supabase
            .from('Appointment')
            .insert([{
                id: appointmentId,
                date: new Date(date).toISOString(),
                time,
                duration: duration || 60,
                observations: observations || null,
                visitDetails: visitDetails || null,
                patientId,
                doctorId: safeDoctorId,
                treatmentId: safeTreatmentId,
                treatmentName: resolvedTreatmentName,
                budgetId: safeBudgetId,
                budgetItemId: safeBudgetItemId || null,
                amount: amount || null,
                status: 'Scheduled',
                paid: false,
                is_revision: isRevision === true,
                created_by: req.user?.id || null,
                updated_by: req.user?.id || null,
            }])
            .select('*, patient:Patient!left(*), doctor:Doctor!left(*)')
            .single();

        if (error) {
            console.error('❌ Supabase Insert Error (Appointment):', JSON.stringify(error));
            return res.status(500).json({ error: `DB Error: ${error.message}`, details: error.details, hint: error.hint });
        }

        logAudit(supabase, {
            userId:       req.user?.id,
            userRole:     req.user?.role,
            action:       'CREATE',
            resourceType: 'appointments',
            resourceId:   data.id,
            newValues:    data,
            ipAddress:    req.ip,
            userAgent:    req.headers['user-agent'],
        });

        // Enrich POST response so Agenda local-state shows updated_by_name immediately
        let response = data;
        try {
            const lookupId = data.created_by || data.updated_by;
            if (lookupId) {
                const nameMap = await resolveUserNames(supabase, [lookupId]);
                response = { ...data, updated_by_name: nameMap.get(lookupId) || null };
            }
        } catch (_) {}

        res.json(response);
    } catch (e) {
        console.error('Error saving appointment:', e);
        res.status(500).json({ error: e.message });
    }
});

// ─── GET all appointments ─────────────────────────────────────────────────────
router.get('/', async (req, res) => {
    try {
        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }

        const twoYearsAgo   = new Date(); twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
        const twoYearsAhead = new Date(); twoYearsAhead.setFullYear(twoYearsAhead.getFullYear() + 2);

        let allData = [];
        let from = 0;
        const PAGE_SIZE = 1000;
        let keepFetching = true;

        while (keepFetching) {
            const { data: page, error } = await supabase
                .from('Appointment')
                .select('*, budget:Budget(id, totalAmount, items:BudgetLineItem(name, price, tooth))')
                .gte('date', twoYearsAgo.toISOString())
                .lte('date', twoYearsAhead.toISOString())
                .is('deleted_at', null)
                .order('date', { ascending: true })
                .range(from, from + PAGE_SIZE - 1);

            if (error) {
                if (allData.length === 0) return res.status(500).json({ error: error.message });
                break;
            }

            allData = allData.concat(page || []);
            keepFetching = (page || []).length === PAGE_SIZE;
            from += PAGE_SIZE;
            if (from > 20000) break;
        }

        // Enrich with user names for last-modifier display (graceful fallback)
        let enriched = allData;
        try {
            const userIds = allData.flatMap(a => [a.updated_by, a.created_by]).filter(Boolean);
            const nameMap = await resolveUserNames(supabase, userIds);
            enriched = allData.map(a => ({
                ...a,
                updated_by_name: a.updated_by ? (nameMap.get(a.updated_by) || null) : (a.created_by ? (nameMap.get(a.created_by) || null) : null),
            }));
        } catch (_) {}

        res.json(enriched);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── GET by patient ───────────────────────────────────────────────────────────
router.get('/patient/:patientId', async (req, res) => {
    try {
        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }

        const { data, error } = await supabase
            .from('Appointment')
            .select('*, patient:Patient!left(*), doctor:Doctor!left(*)')
            .eq('patientId', req.params.patientId)
            .is('deleted_at', null)
            .order('date', { ascending: false });

        if (error) return res.status(500).json({ error: error.message });

        // Enrich with user names (graceful fallback)
        let enriched = data || [];
        try {
            const userIds = (data || []).flatMap(a => [a.updated_by, a.created_by]).filter(Boolean);
            const nameMap = await resolveUserNames(supabase, userIds);
            enriched = (data || []).map(a => ({
                ...a,
                updated_by_name: a.updated_by ? (nameMap.get(a.updated_by) || null) : (a.created_by ? (nameMap.get(a.created_by) || null) : null),
            }));
        } catch (_) {}

        res.json(enriched);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── GET single appointment ───────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
    try {
        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }

        const { data, error } = await supabase
            .from('Appointment').select('*').eq('id', req.params.id).single();

        if (error) return res.status(404).json({ error: `Appointment not found: ${error.message}` });
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── GET single appointment (debug, no deleted_at filter) ────────────────────
router.get('/:id/debug', async (req, res) => {
    try {
        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }

        const { data, error } = await supabase
            .from('Appointment')
            .select('id, date, time, duration, status, deleted_at, patientId, doctorId')
            .eq('id', req.params.id)
            .single();

        if (error) {
            const { data: allRows } = await supabase.from('Appointment').select('id, deleted_at').eq('id', req.params.id);
            return res.json({ found: false, error: error.message, rawRows: allRows || [] });
        }

        res.json({ found: true, appointment: data, isDeleted: data.deleted_at !== null });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── PUT update appointment ───────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = { ...req.body };

        if (typeof updates.budgetId === 'string' && !updates.budgetId.trim()) updates.budgetId = null;
        if (typeof updates.budgetItemId === 'string' && !updates.budgetItemId.trim()) updates.budgetItemId = null;
        if (typeof updates.treatmentId === 'string' && !updates.treatmentId.trim()) updates.treatmentId = null;
        if (typeof updates.doctorId === 'string' && !updates.doctorId.trim()) updates.doctorId = null;
        if (typeof updates.patientId === 'string' && !updates.patientId.trim()) updates.patientId = null;
        if (updates.date) updates.date = new Date(updates.date).toISOString();
        if (updates.isRevision !== undefined) { updates.is_revision = updates.isRevision === true; delete updates.isRevision; }

        if (Array.isArray(updates.serviceIds) && updates.serviceIds.length > 0) {
            try {
                let supabase;
                try { supabase = getSupabase(); } catch (_) {}
                if (supabase) {
                    const { data: svcs } = await supabase.from('services').select('id, name').in('id', updates.serviceIds);
                    if (svcs && svcs.length > 0) updates.treatmentName = svcs.map(s => s.name).join(', ');
                }
            } catch (_) {}
        }

        delete updates.serviceIds; delete updates.budgetItemIds; delete updates.treatment;
        delete updates.doctor; delete updates.patient; delete updates.budget;
        delete updates.liquidation; delete updates.id; delete updates.created_at; delete updates.deleted_at;
        delete updates.created_by; // Never overwrite creation author
        for (const key of Object.keys(updates)) { if (updates[key] === undefined) delete updates[key]; }

        // Stamp the editor
        updates.updated_by = req.user?.id || null;

        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }

        // Fetch old record for audit diff
        const { data: oldRecord } = await supabase.from('Appointment').select('*').eq('id', id).single();

        const { data, error } = await supabase.from('Appointment').update(updates).eq('id', id).select().single();

        if (error) {
            try {
                const updated = await prisma.appointment.update({ where: { id }, data: updates });
                return res.json(updated);
            } catch (prismaErr) {
                return res.status(500).json({ error: error.message, details: error.details });
            }
        }

        logAudit(supabase, {
            userId:       req.user?.id,
            userRole:     req.user?.role,
            action:       'UPDATE',
            resourceType: 'appointments',
            resourceId:   id,
            oldValues:    oldRecord || undefined,
            newValues:    data,
            ipAddress:    req.ip,
            userAgent:    req.headers['user-agent'],
        });

        // Enrich PUT response so Agenda local-state update shows updated_by_name immediately
        let response = data;
        try {
            if (data?.updated_by) {
                const nameMap = await resolveUserNames(supabase, [data.updated_by]);
                response = { ...data, updated_by_name: nameMap.get(data.updated_by) || null };
            }
        } catch (_) {}

        res.json(response);
    } catch (e) {
        console.error('Error updating appointment:', e);
        res.status(500).json({ error: e.message });
    }
});

// ─── DELETE appointment (soft delete) ────────────────────────────────────────
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }

        // Fetch record before deletion for audit trail
        const { data: deletedRecord } = await supabase.from('Appointment').select('*').eq('id', id).single();

        const { error } = await supabase
            .from('Appointment')
            .update({ deleted_at: new Date().toISOString(), updated_by: req.user?.id || null })
            .eq('id', id);

        if (error) {
            try {
                await prisma.appointment.delete({ where: { id } });
            } catch (prismaErr) {
                return res.status(500).json({ error: error.message });
            }
        }

        logAudit(supabase, {
            userId:       req.user?.id,
            userRole:     req.user?.role,
            action:       'DELETE',
            resourceType: 'appointments',
            resourceId:   id,
            oldValues:    deletedRecord || undefined,
            ipAddress:    req.ip,
            userAgent:    req.headers['user-agent'],
        });

        res.json({ success: true });
    } catch (e) {
        console.error('Error deleting appointment:', e);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
