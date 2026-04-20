'use strict';
const express = require('express');
const { getSupabase } = require('../lib/db');

const router = express.Router();

// GET /api/patients/:patientId/prescriptions
router.get('/:patientId/prescriptions', async (req, res) => {
    try {
        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }

        const { data, error } = await supabase
            .from('Prescription')
            .select('*')
            .eq('patientId', req.params.patientId)
            .is('deleted_at', null)
            .order('prescriptionDate', { ascending: false });

        if (error) throw error;
        res.json(data || []);
    } catch (e) {
        console.error('Error fetching prescriptions:', e);
        res.status(500).json({ error: e.message });
    }
});

// POST /api/patients/:patientId/prescriptions
router.post('/:patientId/prescriptions', async (req, res) => {
    try {
        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }

        const { patientId } = req.params;
        const body = req.body;

        if (!body.medication) {
            return res.status(400).json({ error: 'El campo medicamento es obligatorio' });
        }

        const record = {
            patientId,
            doctorId: body.doctorId || req.user?.id || null,
            medication: body.medication,
            pharmaceuticalForm: body.pharmaceuticalForm || null,
            administrationRoute: body.administrationRoute || null,
            packagesNumber: body.packagesNumber ? parseInt(body.packagesNumber) : null,
            dose: body.dose || null,
            duration: body.duration || null,
            posology: body.posology || null,
            units: body.units || null,
            schedulePattern: body.schedulePattern || null,
            prescriptionDate: body.prescriptionDate ? new Date(body.prescriptionDate).toISOString() : new Date().toISOString(),
            dispensationDate: body.dispensationDate ? new Date(body.dispensationDate).toISOString() : null,
            dispensationOrderNumber: body.dispensationOrderNumber || null,
            diagnosis: body.diagnosis || null,
            patientInstructions: body.patientInstructions || null,
            pharmacyInstructions: body.pharmacyInstructions || null,
            prescriberName: body.prescriberName || null,
            prescriberSpecialty: body.prescriberSpecialty || null,
        };

        const { data, error } = await supabase
            .from('Prescription')
            .insert(record)
            .select()
            .single();

        if (error) throw error;
        res.status(201).json(data);
    } catch (e) {
        console.error('Error creating prescription:', e);
        res.status(500).json({ error: e.message });
    }
});

// PUT /api/patients/:patientId/prescriptions/:id
router.put('/:patientId/prescriptions/:id', async (req, res) => {
    try {
        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }

        const { id } = req.params;
        const body = { ...req.body };

        // Strip read-only / relational fields
        delete body.id;
        delete body.createdAt;
        delete body.deleted_at;
        delete body.doctor;
        delete body.patient;

        if (body.prescriptionDate) body.prescriptionDate = new Date(body.prescriptionDate).toISOString();
        if (body.dispensationDate) body.dispensationDate = new Date(body.dispensationDate).toISOString();
        if (body.packagesNumber) body.packagesNumber = parseInt(body.packagesNumber);

        const { data, error } = await supabase
            .from('Prescription')
            .update(body)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (e) {
        console.error('Error updating prescription:', e);
        res.status(500).json({ error: e.message });
    }
});

// DELETE /api/patients/:patientId/prescriptions/:id
router.delete('/:patientId/prescriptions/:id', async (req, res) => {
    try {
        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }

        const { id } = req.params;

        const { error } = await supabase
            .from('Prescription')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', id);

        if (error) throw error;
        res.json({ success: true });
    } catch (e) {
        console.error('Error deleting prescription:', e);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
