'use strict';
const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { prisma, getSupabase } = require('../lib/db');

const router = express.Router();

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
