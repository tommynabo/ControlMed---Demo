'use strict';
const express = require('express');
const crypto = require('crypto');
const { prisma } = require('../lib/db');

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            where: { isActive: true },
            orderBy: { name: 'asc' }
        });
        const mappedUsers = users.map(u => ({
            ...u,
            full_name: u.name,
            is_active: u.isActive,
            isDoctor: u.isDoctor,
            secondary_role: u.secondaryRole || null
        }));
        res.json(mappedUsers);
    } catch (e) {
        console.error('Error fetching system users:', e);
        res.status(500).json({ error: e.message });
    }
});

router.get('/all', async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            orderBy: [
                { role: 'asc' },
                { name: 'asc' }
            ]
        });
        const mappedUsers = users.map(u => ({
            ...u,
            full_name: u.name,
            is_active: u.isActive,
            isDoctor: u.isDoctor,
            secondary_role: u.secondaryRole || null
        }));
        res.json(mappedUsers);
    } catch (e) {
        console.error('Error fetching all system users:', e);
        res.status(500).json({ error: e.message });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const user = await prisma.user.findUnique({
            where: { id }
        });
        if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
        
        res.json({
            ...user,
            full_name: user.name,
            is_active: user.isActive
        });
    } catch (e) {
        console.error('Error fetching system user:', e);
        res.status(500).json({ error: e.message });
    }
});

router.post('/', async (req, res) => {
    try {
        const { email, full_name, role, is_active, password, doctorId, isDoctor, secondary_role } = req.body;

        const ROLE_MAP = { 'ADMIN': 'ADMIN', 'DOCTOR': 'DOCTOR', 'RECEPTIONIST': 'RECEPTION', 'RECEPTION': 'RECEPTION', 'ASSISTANT': 'RECEPTION', 'AUXILIAR': 'RECEPTION' };
        const prismaRole = ROLE_MAP[role] || 'DOCTOR';
        const isDoctorFlag = isDoctor === true || prismaRole === 'DOCTOR';

        const result = await prisma.$transaction(async (tx) => {
            const sharedId = crypto.randomUUID();

            const user = await tx.user.create({
                data: {
                    id: sharedId,
                    email,
                    name: full_name,
                    role: prismaRole,
                    isDoctor: isDoctorFlag,
                    isActive: is_active !== undefined ? is_active : true,
                    password: password || '123',
                    doctorId: doctorId || null,
                    secondaryRole: secondary_role ? (ROLE_MAP[secondary_role] || secondary_role) : null
                }
            });

            if (isDoctorFlag && !doctorId) {
                await tx.doctor.create({
                    data: {
                        id: sharedId,
                        name: full_name,
                        specialization: 'Odontólogo',
                        commissionPercentage: 0
                    }
                });
                await tx.user.update({
                    where: { id: sharedId },
                    data: { doctorId: sharedId }
                });
                await tx.doctorSchedule.create({
                    data: {
                        doctorId: sharedId,
                        doctorName: full_name,
                        monday: true, tuesday: true, wednesday: true,
                        thursday: true, friday: true, saturday: false, sunday: false,
                        morningStart: '09:00:00', morningEnd: '13:00:00',
                        afternoonStart: '16:00:00', afternoonEnd: '20:00:00'
                    }
                });
            }

            return tx.user.findUnique({ where: { id: sharedId } });
        });

        res.status(201).json({
            ...result,
            full_name: result.name,
            is_active: result.isActive,
            isDoctor: result.isDoctor,
            secondary_role: result.secondaryRole || null
        });
    } catch (e) {
        console.error('Error creating system user:', e);
        res.status(500).json({ error: e.message });
   }
});

router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { email, full_name, role, is_active, doctorId, isDoctor, secondary_role } = req.body;

        const SU_ROLE_MAP = { 'ADMIN': 'ADMIN', 'DOCTOR': 'DOCTOR', 'RECEPTIONIST': 'RECEPTION', 'RECEPTION': 'RECEPTION', 'ASSISTANT': 'RECEPTION', 'AUXILIAR': 'RECEPTION' };
        const prismaRole = role ? (SU_ROLE_MAP[role] || role) : undefined;
        const isDoctorFlag = isDoctor !== undefined
            ? isDoctor === true
            : prismaRole === 'DOCTOR' ? true : undefined;

        const updateData = {
            ...(email !== undefined && { email }),
            ...(full_name !== undefined && { name: full_name }),
            ...(prismaRole !== undefined && { role: prismaRole }),
            ...(is_active !== undefined && { isActive: is_active }),
            ...(isDoctorFlag !== undefined && { isDoctor: isDoctorFlag }),
            ...(doctorId !== undefined && { doctorId: doctorId || null }),
            ...(secondary_role !== undefined && { secondaryRole: secondary_role ? (SU_ROLE_MAP[secondary_role] || secondary_role) : null })
        };

        const user = await prisma.$transaction(async (tx) => {
            const updated = await tx.user.update({ where: { id }, data: updateData });

            if (updated.isDoctor) {
                const targetId = updated.doctorId || id;
                const existingDoctor = await tx.doctor.findUnique({ where: { id: targetId } });
                if (!existingDoctor) {
                    await tx.doctor.create({
                        data: { id, name: updated.name, specialization: 'Odontólogo', commissionPercentage: 0 }
                    });
                    await tx.user.update({ where: { id }, data: { doctorId: id } });
                    await tx.doctorSchedule.create({
                        data: {
                            doctorId: id, doctorName: updated.name,
                            monday: true, tuesday: true, wednesday: true,
                            thursday: true, friday: true, saturday: false, sunday: false,
                            morningStart: '09:00:00', morningEnd: '13:00:00',
                            afternoonStart: '16:00:00', afternoonEnd: '20:00:00'
                        }
                    });
                } else if (full_name) {
                    await tx.doctor.update({ where: { id: existingDoctor.id }, data: { name: full_name } });
                }
            }

            return tx.user.findUnique({ where: { id } });
        });

        res.json({
            ...user,
            full_name: user.name,
            is_active: user.isActive,
            isDoctor: user.isDoctor,
            secondary_role: user.secondaryRole || null
        });
    } catch (e) {
        console.error('Error updating system user:', e);
        res.status(500).json({ error: e.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.user.delete({
            where: { id }
        });
        res.status(204).send();
    } catch (e) {
        console.error('Error deleting system user:', e);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
