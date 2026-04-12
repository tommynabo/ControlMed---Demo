'use strict';
const express = require('express');
const { prisma, getSupabase } = require('../lib/db');
const { isUuid, normalizeSchedule } = require('../lib/utils');

const router = express.Router();

const GHOST_DOCTOR_NAMES = new Set([
    'Francisca',
    'Prueba medico',
    'Leticia Rodriguez Silvera',
    'LauraLeticia Rodriguez Silvera',
    'Laura Leticia Rodriguez Silvera',
]);
const GHOST_DOCTOR_IDS = new Set([
    '6c1c4982-70e6-472c-880f-6550c3945c4d',
    'f4f54750-c691-43ae-9f58-15092e184035',
]);

// ─── GET doctors ──────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
    try {
        const allDoctors = await prisma.doctor.findMany({
            orderBy: { name: 'asc' },
            select: {
                id: true, name: true, specialization: true,
                users: { select: { isDoctor: true, role: true, isActive: true } }
            }
        });

        const filtered = allDoctors
            .filter(d => {
                if (GHOST_DOCTOR_IDS.has(d.id) || GHOST_DOCTOR_NAMES.has(d.name)) return false;
                if (d.users.length === 0) return true;
                return d.users.some(u => u.isActive === true && (u.isDoctor === true || u.role === 'DOCTOR'));
            })
            .map(({ users, ...rest }) => rest);

        if (filtered.length > 0) return res.json(filtered);

        // Fallback: no Doctor table rows — derive from User table
        const doctorUsers = await prisma.user.findMany({
            where: { isDoctor: true, isActive: true },
            select: { id: true, name: true, doctorId: true }
        });
        res.json(doctorUsers.map(u => ({ id: u.doctorId || u.id, name: u.name, specialization: 'Odontólogo' })));
    } catch (e) {
        console.error('Error fetching doctors:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// ─── GET doctor commissions ───────────────────────────────────────────────────
router.get('/:doctorId/commissions', async (req, res) => {
    try {
        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }

        const { doctorId } = req.params;
        const targetMonth = req.query.month ? parseInt(req.query.month) : new Date().getMonth() + 1;
        const targetYear  = req.query.year  ? parseInt(req.query.year)  : new Date().getFullYear();

        const startDate = new Date(targetYear, targetMonth - 1, 1).toISOString();
        const endDate   = new Date(targetYear, targetMonth, 0, 23, 59, 59).toISOString();

        const { data: payments, error } = await supabase
            .from('Payment')
            .select('*')
            .eq('doctorId', doctorId)
            .gte('createdAt', startDate)
            .lte('createdAt', endDate);

        if (error) throw error;

        const directPayments = (payments || []).filter(p => p.type === 'DIRECT_CHARGE');
        const transfers      = (payments || []).filter(p => p.type === 'TRANSFER');
        const totalDirect    = directPayments.reduce((s, p) => s + (p.amount || 0), 0);
        const totalTransfers = transfers.reduce((s, p) => s + (p.amount || 0), 0);
        const grandTotal     = totalDirect + totalTransfers;
        const commissionRate = 0.30;

        res.json({
            doctorId,
            period: { month: targetMonth, year: targetYear },
            breakdown: {
                directPayments: { count: directPayments.length, total: totalDirect },
                transfers: { count: transfers.length, total: totalTransfers }
            },
            grandTotal,
            commissionRate: `${commissionRate * 100}%`,
            commissionAmount: parseFloat((grandTotal * commissionRate).toFixed(2)),
            payments: (payments || []).slice(0, 50)
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── DEBUG: doctors sync status ───────────────────────────────────────────────
router.get('/debug', async (req, res) => {
    try {
        const supabase = getSupabase();
        const [{ data: doctors, error: de }, { data: doctorUsers, error: ue }] = await Promise.all([
            supabase.from('Doctor').select('*'),
            supabase.from('User').select('id, name, role').eq('role', 'DOCTOR')
        ]);
        res.json({
            status: 'debug',
            doctor_table: { count: doctors?.length || 0, error: de?.message, doctors: doctors || [] },
            user_table_doctors: { count: doctorUsers?.length || 0, error: ue?.message, users: doctorUsers || [] },
            sync_status: { needs_sync: (doctorUsers?.length || 0) > (doctors?.length || 0) }
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── AUTO-SYNC doctors from User table ───────────────────────────────────────
router.post('/sync', async (req, res) => {
    try {
        const supabase = getSupabase();
        const { data: doctorUsers, error } = await supabase.from('User').select('id, name').eq('isDoctor', true);
        if (error) return res.status(500).json({ error: 'Error fetching doctor users: ' + error.message });
        if (!doctorUsers || doctorUsers.length === 0) return res.json({ success: true, message: 'No doctor users to sync', synced: 0 });

        const results = await Promise.all(
            doctorUsers.map(u => supabase.from('Doctor').upsert({ id: u.id, name: u.name, specialization: 'Odontólogo' }).select())
        );
        const synced = results.filter(r => !r.error).length;
        res.json({ success: true, message: `Synchronized ${synced} doctors`, synced });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── DOCTOR SCHEDULES ─────────────────────────────────────────────────────────
router.get('/schedules', async (req, res) => {
    try {
        const schedules = await prisma.doctorSchedule.findMany({
            where: { isActive: true },
            include: { doctor: true }
        });
        res.json(schedules.map(normalizeSchedule));
    } catch (e) {
        console.error('Error fetching doctor schedules:', e);
        res.status(500).json({ error: e.message });
    }
});

router.get('/schedules/doctor/:doctorId', async (req, res) => {
    try {
        const { doctorId } = req.params;
        if (!isUuid(doctorId)) return res.status(400).json({ error: 'doctorId debe ser un UUID válido' });

        const schedules = await prisma.doctorSchedule.findMany({ where: { doctorId } });
        res.json(schedules.map(normalizeSchedule));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/schedules', async (req, res) => {
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
                doctorName: doctor_name,
                monday:    days.monday    !== undefined ? days.monday    : true,
                tuesday:   days.tuesday   !== undefined ? days.tuesday   : true,
                wednesday: days.wednesday !== undefined ? days.wednesday : true,
                thursday:  days.thursday  !== undefined ? days.thursday  : true,
                friday:    days.friday    !== undefined ? days.friday    : true,
                saturday:  days.saturday  !== undefined ? days.saturday  : false,
                sunday:    days.sunday    !== undefined ? days.sunday    : false,
                morningStart:   days.morning_start,
                morningEnd:     days.morning_end,
                afternoonStart: days.afternoon_start,
                afternoonEnd:   days.afternoon_end,
                notes: notes,
                isActive: is_active !== undefined ? is_active : true
            }
        });

        res.status(201).json(normalizeSchedule(schedule));
    } catch (e) {
        console.error('Error creating doctor schedule:', e);
        res.status(500).json({ error: e.message });
    }
});

router.put('/schedules/:id', async (req, res) => {
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

        if (updates.doctor_name    !== undefined) data.doctorName      = updates.doctor_name;
        if (updates.monday         !== undefined) data.monday          = updates.monday;
        if (updates.tuesday        !== undefined) data.tuesday         = updates.tuesday;
        if (updates.wednesday      !== undefined) data.wednesday       = updates.wednesday;
        if (updates.thursday       !== undefined) data.thursday        = updates.thursday;
        if (updates.friday         !== undefined) data.friday          = updates.friday;
        if (updates.saturday       !== undefined) data.saturday        = updates.saturday;
        if (updates.sunday         !== undefined) data.sunday          = updates.sunday;
        if (updates.morning_start  !== undefined) data.morningStart    = updates.morning_start;
        if (updates.morning_end    !== undefined) data.morningEnd      = updates.morning_end;
        if (updates.afternoon_start !== undefined) data.afternoonStart = updates.afternoon_start;
        if (updates.afternoon_end  !== undefined) data.afternoonEnd    = updates.afternoon_end;
        if (updates.notes          !== undefined) data.notes           = updates.notes;
        if (updates.is_active      !== undefined) data.isActive        = updates.is_active;

        const updated = await prisma.doctorSchedule.update({ where: { id }, data });
        res.json(normalizeSchedule(updated));
    } catch (e) {
        console.error('Error updating doctor schedule:', e);
        res.status(500).json({ error: e.message });
    }
});

router.delete('/schedules/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!isUuid(id)) return res.status(400).json({ error: 'id debe ser un UUID válido' });
        await prisma.doctorSchedule.delete({ where: { id } });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
