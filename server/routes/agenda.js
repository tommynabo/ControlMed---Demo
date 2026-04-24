'use strict';
const express = require('express');
const { prisma } = require('../lib/db');
const crypto = require('crypto');

const router = express.Router();

// ─── Jornada (clock-in / clock-out / manual / history) ───────────────────────

router.post('/jornada/clock-in', async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Usuario no identificado.' });

        const today = new Date().toISOString().split('T')[0];

        const openShift = await prisma.workShift.findFirst({ where: { userId, clockOut: null } });
        if (openShift) return res.status(400).json({ error: 'Ya tienes una jornada abierta.' });

        const newShift = await prisma.workShift.create({
            data: { id: crypto.randomUUID(), userId, clockIn: new Date(), date: today }
        });
        res.status(201).json(newShift);
    } catch (e) {
        console.error('Error clock-in:', e);
        res.status(500).json({ error: 'Error interno al registrar entrada.', details: e.message });
    }
});

router.put('/jornada/clock-out', async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Usuario no identificado.' });

        const openShift = await prisma.workShift.findFirst({ where: { userId, clockOut: null } });
        if (!openShift) return res.status(400).json({ error: 'No tienes ninguna jornada abierta para cerrar.' });

        const updatedShift = await prisma.workShift.update({
            where: { id: openShift.id },
            data: { clockOut: new Date() }
        });
        res.json(updatedShift);
    } catch (e) {
        console.error('Error clock-out:', e);
        res.status(500).json({ error: 'Error interno al registrar salida.', details: e.message });
    }
});

router.post('/jornada/manual', async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Usuario no identificado.' });

        const { date, startTime, endTime, breakMinutes, notes } = req.body;
        if (!date || !startTime || !endTime) {
            return res.status(400).json({ error: 'Faltan campos obligatorios (fecha, inicio, fin).' });
        }

        const clockIn  = new Date(`${date}T${startTime}:00`);
        const clockOut = new Date(`${date}T${endTime}:00`);

        if (clockOut <= clockIn) {
            return res.status(400).json({ error: 'La hora de fin debe ser posterior a la de inicio.' });
        }

        const newShift = await prisma.workShift.create({
            data: {
                id: crypto.randomUUID(),
                userId,
                clockIn,
                clockOut,
                breakMinutes: parseInt(breakMinutes) || 0,
                notes,
                isManual: true,
                date
            }
        });
        res.status(201).json(newShift);
    } catch (e) {
        console.error('Error jornada manual:', e);
        res.status(500).json({ error: 'Error al registrar jornada manual.', details: e.message });
    }
});

router.get('/jornada/history', async (req, res) => {
    try {
        const userId = req.user?.id;
        const role   = req.user?.role;
        if (!userId) return res.status(401).json({ error: 'Usuario no identificado.' });

        const whereClause = role === 'ADMIN' ? {} : { userId };

        const history = await prisma.workShift.findMany({
            where: whereClause,
            include: { user: { select: { name: true } } },
            orderBy: { clockIn: 'desc' }
        });
        res.json(history);
    } catch (e) {
        console.error('Error jornada history:', e);
        res.status(500).json({ error: 'Error interno al obtener el historial.', details: e.message });
    }
});

// ─── Agenda Closures ──────────────────────────────────────────────────────────

router.get('/agenda-closures', async (req, res) => {
    try {
        const { date, doctorId } = req.query;
        const whereClause = {};

        if (date) whereClause.date = new Date(date);
        if (doctorId) {
            whereClause.OR = [{ doctorId }, { doctorId: null }];
        }

        const data = await prisma.agendaClosure.findMany({
            where: whereClause,
            orderBy: { date: 'desc' }
        });
        res.json(data || []);
    } catch (e) {
        console.error('Error fetching agenda closures:', e);
        res.status(500).json({ error: e.message });
    }
});

router.post('/agenda-closures', async (req, res) => {
    try {
        const { date, doctorId, reason, createdBy } = req.body;
        if (!date) return res.status(400).json({ error: 'date is required' });

        // Validate doctorId exists in Doctor table before creating (prevents FK constraint error)
        if (doctorId) {
            const doctor = await prisma.doctor.findUnique({ where: { id: doctorId }, select: { id: true } });
            if (!doctor) {
                return res.status(400).json({ error: `Doctor con ID "${doctorId}" no encontrado. Puede que haya sido eliminado.` });
            }
        }

        const checkWhere = { date: new Date(date), doctorId: doctorId || null };
        const existing = await prisma.agendaClosure.findMany({ where: checkWhere });
        if (existing && existing.length > 0) {
            return res.status(409).json({ error: 'This agenda is already closed for this date' });
        }

        const data = await prisma.agendaClosure.create({
            data: {
                id: crypto.randomUUID(),
                date: new Date(date),
                doctorId: doctorId || null,
                reason: reason || null,
                createdBy: createdBy || null
            }
        });
        res.status(201).json(data);
    } catch (e) {
        console.error('Error creating agenda closure:', e);
        res.status(500).json({ error: e.message });
    }
});

router.delete('/agenda-closures/:id', async (req, res) => {
    try {
        await prisma.agendaClosure.delete({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (e) {
        console.error('Error deleting agenda closure:', e);
        res.status(500).json({ error: e.message });
    }
});

// ─── Vacations ────────────────────────────────────────────────────────────────

router.get('/vacations', async (req, res) => {
    try {
        const data = await prisma.vacation.findMany({ orderBy: { startDate: 'asc' } });
        res.json(data || []);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/vacations', async (req, res) => {
    try {
        const { startDate, endDate, doctorId, reason } = req.body;
        const data = await prisma.vacation.create({
            data: { id: crypto.randomUUID(), startDate: new Date(startDate), endDate: new Date(endDate), doctorId: doctorId || null, reason: reason || null }
        });
        res.status(201).json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.put('/vacations/:id', async (req, res) => {
    try {
        const { startDate, endDate, doctorId, reason } = req.body;
        const updates = {};
        if (startDate !== undefined) updates.startDate = new Date(startDate);
        if (endDate !== undefined)   updates.endDate   = new Date(endDate);
        if (doctorId !== undefined)  updates.doctorId  = doctorId;
        if (reason !== undefined)    updates.reason    = reason;

        const data = await prisma.vacation.update({ where: { id: req.params.id }, data: updates });
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/vacations/:id', async (req, res) => {
    try {
        await prisma.vacation.delete({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
