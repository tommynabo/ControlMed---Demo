'use strict';
const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { prisma, getSupabase } = require('../lib/db');

const router = express.Router();

const VALID_ROLES = ['ADMIN', 'RECEPTION', 'AUXILIAR', 'DOCTOR'];
const ROLE_MAP = {
    ADMIN: 'ADMIN', DOCTOR: 'DOCTOR',
    RECEPTIONIST: 'RECEPTION', RECEPTION: 'RECEPTION',
    ASSISTANT: 'RECEPTION', AUXILIAR: 'RECEPTION'
};

// ─── Login ────────────────────────────────────────────────────────────────────
// Note: loginLimiter is applied at the router mount point in index.js
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email y contraseña son requeridos.' });
    try {
        console.log(`🔐 Login attempt: ${email}`);

        const user = await prisma.user.findFirst({
            where: { email: { equals: email, mode: 'insensitive' } }
        });

        if (!user) {
            // Constant-time response to prevent user enumeration
            await bcrypt.compare(password, '$2b$10$invalidhashpadding000000000000000000000000000000000000');
            return res.status(401).json({ error: 'Credenciales incorrectas' });
        }

        // Support bcrypt hashes and plaintext legacy passwords
        let passwordValid = false;
        const looksLikeBcrypt = user.password && user.password.startsWith('$2');
        if (looksLikeBcrypt) {
            passwordValid = await bcrypt.compare(password, user.password);
        } else {
            passwordValid = user.password === password;
            if (passwordValid) {
                const newHash = await bcrypt.hash(password, 12);
                await prisma.user.update({ where: { id: user.id }, data: { password: newHash } });
                console.log(`🔒 Password auto-upgraded to bcrypt for: ${user.email}`);
            }
        }

        if (!passwordValid) return res.status(401).json({ error: 'Credenciales incorrectas' });

        const JWT_SECRET = process.env.JWT_SECRET;
        const token = jwt.sign(
            { sub: user.id, role: user.role },
            JWT_SECRET,
            { expiresIn: '8h', issuer: 'crm-medico' }
        );

        const { password: _pw, ...safeUser } = user;
        console.log(`✅ Login Success: ${user.name} (${user.role})`);
        res.json({ ...safeUser, token });
    } catch (e) {
        console.error('🔥 Critical Login Error:', e);
        res.status(500).json({ error: e.message });
    }
});

// ─── GET all users ────────────────────────────────────────────────────────────
router.get('/users', async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            orderBy: { createdAt: 'desc' },
            select: { id: true, email: true, name: true, role: true, isDoctor: true, doctorId: true, createdAt: true }
        });
        res.json(users);
    } catch (e) {
        console.error('Error fetching users:', e);
        res.status(500).json({ error: e.message });
    }
});

// ─── POST create user ─────────────────────────────────────────────────────────
router.post('/users', async (req, res) => {
    try {
        const { email, name, password, role } = req.body;
        if (!email || !name || !password || !role) {
            return res.status(400).json({ error: 'Email, nombre, contraseña y rol son obligatorios' });
        }

        const prismaRole = ROLE_MAP[role] || role;
        if (!VALID_ROLES.includes(prismaRole)) {
            return res.status(400).json({ error: `Rol inválido. Roles válidos: ${VALID_ROLES.join(', ')}` });
        }

        const isDoctorFlag = req.body.isDoctor === true || prismaRole === 'DOCTOR';

        const result = await prisma.$transaction(async (tx) => {
            const existing = await tx.user.findUnique({ where: { email } });
            if (existing) throw new Error('Ya existe un usuario con ese email');

            const sharedId = crypto.randomUUID();
            const user = await tx.user.create({
                data: { id: sharedId, email, name, password, role: prismaRole, isDoctor: isDoctorFlag }
            });

            if (isDoctorFlag) {
                await tx.doctor.create({
                    data: { id: sharedId, name, specialization: 'Odontólogo', commissionPercentage: 0 }
                });
                await tx.user.update({ where: { id: sharedId }, data: { doctorId: sharedId } });
                await tx.doctorSchedule.create({
                    data: {
                        doctorId: sharedId, doctorName: name,
                        monday: true, tuesday: true, wednesday: true,
                        thursday: true, friday: true, saturday: false, sunday: false,
                        morningStart: '09:00:00', morningEnd: '13:00:00',
                        afternoonStart: '16:00:00', afternoonEnd: '20:00:00'
                    }
                });
            }

            return tx.user.findUnique({
                where: { id: sharedId },
                select: { id: true, email: true, name: true, role: true, isDoctor: true, doctorId: true, createdAt: true }
            });
        });

        console.log(`✅ User created: ${name} (${role}, isDoctor=${isDoctorFlag})`);
        res.status(201).json(result);
    } catch (e) {
        console.error('Error creating user:', e);
        res.status(e.message.includes('existe') ? 409 : 500).json({ error: e.message });
    }
});

// ─── PUT update user ──────────────────────────────────────────────────────────
router.put('/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { email, name, password, role, doctorId } = req.body;

        const prismaRole = role ? (ROLE_MAP[role] || role) : undefined;
        if (prismaRole && !VALID_ROLES.includes(prismaRole)) {
            return res.status(400).json({ error: `Rol inválido. Roles válidos: ${VALID_ROLES.join(', ')}` });
        }

        const isDoctorFlag = req.body.isDoctor !== undefined
            ? req.body.isDoctor === true
            : prismaRole === 'DOCTOR' ? true : undefined;

        const updateData = {
            ...(email !== undefined && { email }),
            ...(name !== undefined && { name }),
            ...(password !== undefined && password !== '' && { password }),
            ...(prismaRole !== undefined && { role: prismaRole }),
            ...(isDoctorFlag !== undefined && { isDoctor: isDoctorFlag }),
            ...(doctorId !== undefined && { doctorId: doctorId || null })
        };

        const updated = await prisma.$transaction(async (tx) => {
            const user = await tx.user.update({
                where: { id },
                data: updateData,
                select: { id: true, email: true, name: true, role: true, isDoctor: true, doctorId: true, createdAt: true }
            });

            if (user.isDoctor) {
                const existingDoctor = await tx.doctor.findUnique({ where: { id: user.doctorId || id } });
                if (!existingDoctor) {
                    await tx.doctor.create({ data: { id, name: user.name, specialization: 'Odontólogo', commissionPercentage: 0 } });
                    await tx.user.update({ where: { id }, data: { doctorId: id } });
                    await tx.doctorSchedule.create({
                        data: {
                            doctorId: id, doctorName: user.name,
                            monday: true, tuesday: true, wednesday: true,
                            thursday: true, friday: true, saturday: false, sunday: false,
                            morningStart: '09:00:00', morningEnd: '13:00:00',
                            afternoonStart: '16:00:00', afternoonEnd: '20:00:00'
                        }
                    });
                } else if (name) {
                    await tx.doctor.update({ where: { id: existingDoctor.id }, data: { name } });
                }
            }

            return tx.user.findUnique({
                where: { id },
                select: { id: true, email: true, name: true, role: true, isDoctor: true, doctorId: true, createdAt: true }
            });
        });

        console.log(`✅ User updated: ${updated.name} (${updated.role})`);
        res.json(updated);
    } catch (e) {
        console.error('Error updating user:', e);
        res.status(500).json({ error: e.message });
    }
});

// ─── DELETE user ──────────────────────────────────────────────────────────────
router.delete('/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.$transaction(async (tx) => {
            const user = await tx.user.findUnique({ where: { id } });
            if (user && user.doctorId === user.id) {
                await tx.doctorSchedule.deleteMany({ where: { doctorId: id } });
                await tx.doctor.delete({ where: { id } });
            }
            await tx.user.delete({ where: { id } });
        });
        console.log(`🗑️ User deleted: ${id}`);
        res.json({ success: true });
    } catch (e) {
        console.error('Error deleting user:', e);
        res.status(500).json({ error: e.message });
    }
});

// ─── PATCH display name ───────────────────────────────────────────────────────
router.patch('/users/:id/display-name', async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;

        if (!name || typeof name !== 'string' || !name.trim()) {
            return res.status(400).json({ error: 'El nombre no puede estar vacío' });
        }
        const trimmedName = name.trim().slice(0, 100);

        const updated = await prisma.user.update({
            where: { id },
            data: { name: trimmedName },
            select: { id: true, email: true, name: true, role: true, doctorId: true, createdAt: true }
        });

        if (updated.doctorId) {
            try {
                await prisma.doctor.update({ where: { id: updated.doctorId }, data: { name: trimmedName } });
            } catch (_) { /* ignore if no doctor record */ }
        }

        res.json(updated);
    } catch (e) {
        console.error('Error updating display name:', e);
        res.status(500).json({ error: e.message });
    }
});

// ─── POST change password ─────────────────────────────────────────────────────
router.post('/change-password', async (req, res) => {
    try {
        const { userId, currentPassword, newPassword } = req.body;
        if (!userId || !currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Faltan campos obligatorios' });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
        }

        const supabase = getSupabase();

        const { data: user, error: fetchErr } = await supabase
            .from('User').select('id, password').eq('id', userId).single();

        if (fetchErr || !user) return res.status(404).json({ error: 'Usuario no encontrado' });
        if (user.password !== currentPassword) return res.status(401).json({ error: 'La contraseña actual es incorrecta' });

        const { error: updateErr } = await supabase
            .from('User').update({ password: newPassword }).eq('id', userId);
        if (updateErr) throw updateErr;

        res.json({ success: true, message: 'Contraseña actualizada correctamente' });
    } catch (e) {
        console.error('Error changing password:', e);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
