'use strict';
const express = require('express');
const { prisma, getSupabase } = require('../lib/db');
const { isUuid, normalizeSchedule } = require('../lib/utils');

const router = express.Router();

// ─── DOCTOR SCHEDULES ─────────────────────────────────────────────────────────
// GET /api/doctor-schedules  →  list all active schedules
router.get('/', async (req, res) => {
    try {
        const schedules = await prisma.doctorSchedule.findMany({
            where: { isActive: true },
            include: { doctor: { select: { name: true } } }
        });
        // Override doctorName with the live value from the Doctor table to prevent ghost names
        const normalized = schedules.map(s => ({
            ...normalizeSchedule(s),
            doctor_name: s.doctor?.name ?? normalizeSchedule(s).doctor_name,
            doctorName:  s.doctor?.name ?? normalizeSchedule(s).doctorName
        }));
        res.json(normalized);
    } catch (e) {
        console.error('Error fetching doctor schedules:', e);
        res.status(500).json({ error: e.message });
    }
});

// GET /api/doctor-schedules/doctor/:doctorId  →  schedules for a specific doctor
router.get('/doctor/:doctorId', async (req, res) => {
    try {
        const { doctorId } = req.params;
        if (!isUuid(doctorId)) return res.status(400).json({ error: 'doctorId debe ser un UUID válido' });

        const schedules = await prisma.doctorSchedule.findMany({
            where: { doctorId },
            include: { doctor: { select: { name: true } } }
        });
        const normalized = schedules.map(s => ({
            ...normalizeSchedule(s),
            doctor_name: s.doctor?.name ?? normalizeSchedule(s).doctor_name,
            doctorName:  s.doctor?.name ?? normalizeSchedule(s).doctorName
        }));
        res.json(normalized);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/doctor-schedules  →  create new schedule
router.post('/', async (req, res) => {
    try {
        const { doctor_id, doctorId, doctor_name, notes, is_active, ...days } = req.body;
        const safeDoctorId = doctorId || doctor_id;
        if (!safeDoctorId) return res.status(400).json({ error: 'doctor_id es obligatorio' });
        if (!isUuid(safeDoctorId)) return res.status(400).json({ error: 'doctor_id debe ser un UUID válido' });

        const doctorExists = await prisma.doctor.findUnique({ where: { id: safeDoctorId } });
        if (!doctorExists) return res.status(404).json({ error: 'El doctor especificado no existe' });

        const schedule = await prisma.doctorSchedule.create({
            data: {
                doctorId: safeDoctorId,
                doctorName: doctorExists.name, // always use canonical Doctor.name
                monday:    days.monday    !== undefined ? days.monday    : true,
                tuesday:   days.tuesday   !== undefined ? days.tuesday   : true,
                wednesday: days.wednesday !== undefined ? days.wednesday : true,
                thursday:  days.thursday  !== undefined ? days.thursday  : true,
                friday:    days.friday    !== undefined ? days.friday    : true,
                saturday:  days.saturday  !== undefined ? days.saturday  : false,
                sunday:    days.sunday    !== undefined ? days.sunday    : false,
                morningStart:   days.morning_start   !== undefined ? days.morning_start   : null,
                morningEnd:     days.morning_end     !== undefined ? days.morning_end     : null,
                afternoonStart: days.afternoon_start !== undefined ? days.afternoon_start : null,
                afternoonEnd:   days.afternoon_end   !== undefined ? days.afternoon_end   : null,
                notes:    notes,
                isActive: is_active !== undefined ? is_active : true
            }
        });

        res.status(201).json(normalizeSchedule(schedule));
    } catch (e) {
        console.error('Error creating doctor schedule:', e);
        res.status(500).json({ error: e.message });
    }
});

// PUT /api/doctor-schedules/:id  →  update schedule (also used for soft-delete via is_active: false)
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!isUuid(id)) return res.status(400).json({ error: 'id debe ser un UUID válido' });

        const updates = req.body;
        const data = {};

        const safeDoctorId = updates.doctorId || updates.doctor_id;
        if (safeDoctorId) {
            if (!isUuid(safeDoctorId)) return res.status(400).json({ error: 'doctor_id debe ser un UUID válido' });
            const exists = await prisma.doctor.findUnique({ where: { id: safeDoctorId } });
            if (!exists) return res.status(404).json({ error: 'El doctor especificado no existe' });
            data.doctorId = safeDoctorId;
        }

        if (updates.doctor_name     !== undefined) data.doctorName      = updates.doctor_name;
        if (updates.monday          !== undefined) data.monday          = updates.monday;
        if (updates.tuesday         !== undefined) data.tuesday         = updates.tuesday;
        if (updates.wednesday       !== undefined) data.wednesday       = updates.wednesday;
        if (updates.thursday        !== undefined) data.thursday        = updates.thursday;
        if (updates.friday          !== undefined) data.friday          = updates.friday;
        if (updates.saturday        !== undefined) data.saturday        = updates.saturday;
        if (updates.sunday          !== undefined) data.sunday          = updates.sunday;
        if (updates.morning_start   !== undefined) data.morningStart    = updates.morning_start;
        if (updates.morning_end     !== undefined) data.morningEnd      = updates.morning_end;
        if (updates.afternoon_start !== undefined) data.afternoonStart  = updates.afternoon_start;
        if (updates.afternoon_end   !== undefined) data.afternoonEnd    = updates.afternoon_end;
        if (updates.notes           !== undefined) data.notes           = updates.notes;
        if (updates.is_active       !== undefined) data.isActive        = updates.is_active;

        const updated = await prisma.doctorSchedule.update({ where: { id }, data });
        res.json(normalizeSchedule(updated));
    } catch (e) {
        console.error('Error updating doctor schedule:', e);
        res.status(500).json({ error: e.message });
    }
});

// DELETE /api/doctor-schedules/:id  →  hard delete
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!isUuid(id)) return res.status(400).json({ error: 'id debe ser un UUID válido' });
        await prisma.doctorSchedule.delete({ where: { id } });
        res.json({ success: true });
    } catch (e) {
        console.error('Error deleting doctor schedule:', e);
        res.status(500).json({ error: e.message });
    }
});

// ─── SERVICE DURATIONS ────────────────────────────────────────────────────────
// These are mounted separately at /api/schedule/durations via the durationsRouter export

const durationsRouter = express.Router();

// GET /api/schedule/durations
durationsRouter.get('/', async (req, res) => {
    try {
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('service_durations')
            .select('*')
            .order('specialty', { ascending: true });
        if (error) throw error;
        res.json(data || []);
    } catch (e) {
        console.error('Error fetching service durations:', e);
        res.status(500).json({ error: e.message });
    }
});

// POST /api/schedule/durations
durationsRouter.post('/', async (req, res) => {
    try {
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('service_durations')
            .insert([req.body])
            .select()
            .single();
        if (error) throw error;
        res.status(201).json(data);
    } catch (e) {
        console.error('Error creating service duration:', e);
        res.status(500).json({ error: e.message });
    }
});

// PUT /api/schedule/durations/:id
durationsRouter.put('/:id', async (req, res) => {
    try {
        const supabase = getSupabase();
        const { id } = req.params;
        const { data, error } = await supabase
            .from('service_durations')
            .update(req.body)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        res.json(data);
    } catch (e) {
        console.error('Error updating service duration:', e);
        res.status(500).json({ error: e.message });
    }
});

// DELETE /api/schedule/durations/:id
durationsRouter.delete('/:id', async (req, res) => {
    try {
        const supabase = getSupabase();
        const { id } = req.params;
        const { error } = await supabase
            .from('service_durations')
            .delete()
            .eq('id', id);
        if (error) throw error;
        res.json({ success: true });
    } catch (e) {
        console.error('Error deleting service duration:', e);
        res.status(500).json({ error: e.message });
    }
});

// POST /api/doctor-schedules/cleanup  →  remove orphaned schedules (admin only)
router.post('/cleanup', async (req, res) => {
    try {
        // Delete schedules whose doctorId no longer exists in Doctor table
        const deleted = await prisma.doctorSchedule.deleteMany({
            where: {
                doctor: null  // Prisma will translate this to: doctorId NOT in Doctor table
            }
        });
        // Additionally, sync all remaining schedules to use current Doctor.name
        const active = await prisma.doctorSchedule.findMany({
            include: { doctor: { select: { id: true, name: true } } }
        });
        let synced = 0;
        for (const s of active) {
            if (s.doctor && s.doctorName !== s.doctor.name) {
                await prisma.doctorSchedule.update({
                    where: { id: s.id },
                    data: { doctorName: s.doctor.name }
                });
                synced++;
            }
        }
        res.json({ deletedOrphans: deleted.count, syncedNames: synced });
    } catch (e) {
        console.error('Error during schedule cleanup:', e);
        res.status(500).json({ error: e.message });
    }
});

module.exports = { scheduleRouter: router, durationsRouter };
