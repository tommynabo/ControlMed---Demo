'use strict';
const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { prisma, getSupabase } = require('../lib/db');

const router = express.Router();

function normalizeRole(role) {
    const value = String(role || '').trim().toUpperCase();
    if (['ADMIN', 'RECEPTION', 'AUXILIAR', 'DOCTOR'].includes(value)) return value;
    return 'ADMIN';
}

function isDbConnectivityError(err) {
    const msg = String(err?.message || err || '').toLowerCase();
    return msg.includes("can't reach database server")
        || msg.includes('tenant or user not found')
        || msg.includes('tenant/user')
        || msg.includes('enotfound')
        || msg.includes('authentication failed against database server');
}

function canUseDemoBypass() {
    if (!process.env.DEMO_RESET_SECRET) return false;
    return process.env.DEMO_BYPASS_LOGIN !== 'false';
}

function tryDemoBypassLogin(email, password) {
    if (!canUseDemoBypass()) return null;

    const demoEmail = process.env.DEMO_LOGIN_EMAIL || 'demo@controlmed.local';
    const demoPassword = process.env.DEMO_LOGIN_PASSWORD || 'demo1234';
    const demoName = process.env.DEMO_LOGIN_NAME || 'Demo Admin';
    const demoRole = normalizeRole(process.env.DEMO_LOGIN_ROLE || 'ADMIN');

    if (email !== demoEmail || password !== demoPassword) return null;

    return {
        id: process.env.DEMO_LOGIN_USER_ID || 'demo-bypass-user',
        email: demoEmail,
        name: demoName,
        role: demoRole,
        doctorId: null,
    };
}

async function findUserViaSupabase(email) {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('User')
        .select('*')
        .ilike('email', email)
        .limit(1)
        .maybeSingle();

    if (error) throw error;
    return data || null;
}

function buildDemoBypassResponse() {
    const demoEmail = process.env.DEMO_LOGIN_EMAIL || 'demo@controlmed.local';
    const demoPassword = process.env.DEMO_LOGIN_PASSWORD || 'demo1234';
    const demoName = process.env.DEMO_LOGIN_NAME || 'Demo Admin';
    const demoRole = normalizeRole(process.env.DEMO_LOGIN_ROLE || 'ADMIN');
    const demoId = process.env.DEMO_LOGIN_USER_ID || 'demo-bypass-user';

    const JWT_SECRET = process.env.JWT_SECRET;
    const token = jwt.sign(
        { sub: demoId, role: demoRole },
        JWT_SECRET,
        { expiresIn: '8h', issuer: 'crm-medico' }
    );

    return {
        token,
        user: {
            id: demoId,
            email: demoEmail,
            name: demoName,
            role: demoRole,
            doctorId: null,
        },
        credentials: {
            email: demoEmail,
            password: demoPassword,
        }
    };
}

// ─── Login ────────────────────────────────────────────────────────────────────
// Note: loginLimiter is applied at the router mount point in index.js
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email y contraseña son requeridos.' });
    try {
        console.log(`🔐 Login attempt: ${email}`);

        let user;
        let usedSupabaseFallback = false;
        if (process.env.DEMO_RESET_SECRET) {
            // In demo deployments we prioritize Supabase REST to avoid hard dependency
            // on direct Postgres connectivity for login.
            try {
                user = await findUserViaSupabase(email);
                usedSupabaseFallback = true;
            } catch (supabaseErr) {
                console.warn('⚠️ Demo login via Supabase REST failed, trying Prisma:', supabaseErr?.message || supabaseErr);
            }
        }

        if (user) {
            user = { ...user, role: normalizeRole(user.role) };
        }

        if (!user) {
            try {
                user = await prisma.user.findFirst({
                    where: { email: { equals: email, mode: 'insensitive' } }
                });
            } catch (dbErr) {
                if (!isDbConnectivityError(dbErr)) throw dbErr;

                console.warn('⚠️ Prisma DB unreachable in login, trying Supabase REST fallback...');
                try {
                    user = await findUserViaSupabase(email);
                    usedSupabaseFallback = true;
                } catch (fallbackErr) {
                    console.error('❌ Supabase fallback login failed:', fallbackErr?.message || fallbackErr);
                }

                if (user) {
                    console.warn('✅ Login fallback via Supabase REST is active.');
                }

                if (!user) {
                    const demoUser = tryDemoBypassLogin(email, password);
                    if (demoUser) {
                        const JWT_SECRET = process.env.JWT_SECRET;
                        const token = jwt.sign(
                            { sub: demoUser.id, role: demoUser.role },
                            JWT_SECRET,
                            { expiresIn: '8h', issuer: 'crm-medico' }
                        );

                        console.warn('⚠️ Demo bypass login enabled due to DB connectivity issue.');
                        return res.json({ ...demoUser, token, demoBypass: true });
                    }

                    if (canUseDemoBypass()) {
                        const forcedDemo = buildDemoBypassResponse();
                        console.warn('⚠️ Forced demo login issued because DB is unavailable.');
                        return res.json({
                            ...forcedDemo.user,
                            token: forcedDemo.token,
                            demoBypass: true,
                            forcedDemoBypass: true,
                            credentials: forcedDemo.credentials,
                        });
                    }

                    {
                        return res.status(503).json({
                            error: 'Login temporalmente no disponible por conexión de base de datos',
                            hint: 'Activa DEMO_BYPASS_LOGIN=true o usa credenciales demo por defecto en modo demo'
                        });
                    }
                }
            }
        }

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
                if (usedSupabaseFallback) {
                    const supabase = getSupabase();
                    await supabase.from('User').update({ password: newHash }).eq('id', user.id);
                } else {
                    await prisma.user.update({ where: { id: user.id }, data: { password: newHash } });
                }
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

// ─── Demo Login (no DB required) ─────────────────────────────────────────────
router.post('/demo-login', async (_req, res) => {
    try {
        if (!canUseDemoBypass()) {
            return res.status(403).json({ error: 'Demo login desactivado' });
        }

        const demo = buildDemoBypassResponse();
        console.warn('⚠️ Demo login endpoint used.');
        return res.json({ ...demo.user, token: demo.token, demoBypass: true, credentials: demo.credentials });
    } catch (e) {
        console.error('Error in demo-login:', e);
        return res.status(500).json({ error: e.message });
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
