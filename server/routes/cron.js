'use strict';
const express = require('express');
const { prisma } = require('../lib/db');
const whatsappService = require('../services/whatsappService');

const router = express.Router();

// ─── CRON secret validation helper ───────────────────────────────────────────
function validateCronSecret(req, res) {
    const authHeader = req.headers['authorization'] || req.headers['x-cron-secret'];
    const expectedSecret = process.env.CRON_SECRET;

    if (!expectedSecret) {
        res.status(500).json({ error: 'Configuración del servidor incompleta' });
        return false;
    }

    const headerToken = authHeader ? authHeader.replace(/^Bearer\s+/i, '').trim() : null;
    const queryToken  = req.query?.token ? String(req.query.token).trim() : null;

    const isAuthorized = (headerToken && headerToken === expectedSecret.trim())
                      || (queryToken  && queryToken  === expectedSecret.trim());

    if (!isAuthorized) {
        console.warn(`[CRON] Intento no autorizado. Header: ${headerToken ? '***' : 'NULO'}, Query token: ${queryToken ? '***' : 'NULO'}`);
        res.status(401).json({ error: 'Unauthorized' });
        return false;
    }
    return true;
}

// ─── MASTER CRON: Appointment reminders + Birthdays + Follow-ups ─────────────
router.post('/whatsapp-reminders', async (req, res) => {
    if (!validateCronSecret(req, res)) return;

    const globalStats = {
        reminders: { sent: 0, failed: 0, skipped: 0 },
        birthdays:  { sent: 0, failed: 0, skipped: 0 },
        followups:  { sent: 0, failed: 0, skipped: 0 }
    };

    // ── BLOQUE 1: Recordatorios de citas (mañana) ────────────────────────────
    try {
        console.log('[MASTER CRON] ▶️ Bloque 1 — Recordatorios de citas...');

        const nowMadrid = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Madrid' }));
        const tomorrowMadrid = new Date(nowMadrid);
        tomorrowMadrid.setDate(tomorrowMadrid.getDate() + 1);

        const madridOffset = nowMadrid.getTime() - new Date().getTime();
        const startOfTomorrowMadrid = new Date(new Date(tomorrowMadrid).setHours(0, 0, 0, 0));
        const endOfTomorrowMadrid   = new Date(new Date(tomorrowMadrid).setHours(23, 59, 59, 999));
        const startWindow = new Date(startOfTomorrowMadrid.getTime() - madridOffset);
        const endWindow   = new Date(endOfTomorrowMadrid.getTime() - madridOffset);

        const appointments = await prisma.appointment.findMany({
            where: {
                status: { in: ['Scheduled', 'Confirmed'] },
                date: { gte: startWindow, lte: endWindow },
                whatsappSent: false
            },
            include: { patient: true, treatment: true }
        });

        console.log(`[MASTER CRON] Citas encontradas: ${appointments.length}`);

        const reminderTemplate = await prisma.whatsAppTemplate.findFirst({
            where: { triggerType: 'APPOINTMENT_REMINDER' }
        });

        if (reminderTemplate) {
            for (const appt of appointments) {
                if (!appt.patient?.phone) { globalStats.reminders.skipped++; continue; }

                const appointmentDate = new Date(appt.date);
                const formattedDate = appointmentDate.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Madrid' });
                const formattedTime = appt.time ? appt.time.substring(0, 5)
                    : appointmentDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Madrid' });
                const treatmentName = appt.treatmentName || appt.treatment?.name || 'Consulta General';

                const message = reminderTemplate.content
                    .replace(/{{nombre}}/g, appt.patient.name)
                    .replace(/{{fecha}}/g, formattedDate)
                    .replace(/{{hora}}/g, formattedTime)
                    .replace(/{{tratamiento}}/g, treatmentName);

                let number = appt.patient.phone.replace(/[^0-9]/g, '');
                if (number.length === 9) number = '34' + number;
                const messageWithOptOut = message + '\n\n_Responde "NO" para dejar de recibir avisos_';

                await prisma.whatsAppQueue.create({
                    data: { phone: number, message: messageWithOptOut, status: 'PENDING' }
                });
                await prisma.appointment.update({ where: { id: appt.id }, data: { whatsappSent: true } });
                await prisma.whatsAppLog.create({
                    data: { patientId: appt.patientId, type: 'APPOINTMENT_REMINDER', status: 'PENDING', content: messageWithOptOut, sentAt: new Date() }
                });
                globalStats.reminders.sent++;
            }
        }

        console.log('[MASTER CRON] ✅ Bloque 1 completado:', globalStats.reminders);
    } catch (e) {
        console.error('[MASTER CRON] ❌ Error en Bloque 1 (Recordatorios):', e.message);
    }

    // ── BLOQUE 2: Cumpleaños ─────────────────────────────────────────────────
    try {
        console.log('[MASTER CRON] ▶️ Bloque 2 — Cumpleaños...');

        const nowMadrid = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Madrid' }));
        const todayMonth = nowMadrid.getMonth() + 1;
        const todayDay   = nowMadrid.getDate();
        const startOfToday = new Date();
        startOfToday.setUTCHours(0, 0, 0, 0);

        const allPatients = await prisma.patient.findMany({
            where: { phone: { not: null } },
            select: { id: true, name: true, phone: true, birthDate: true }
        });

        const birthdayPatients = allPatients.filter(p => {
            if (!p.birthDate) return false;
            const bd = new Date(p.birthDate);
            return bd.getMonth() + 1 === todayMonth && bd.getDate() === todayDay;
        });

        const birthdayTemplate = await prisma.whatsAppTemplate.findFirst({ where: { triggerType: 'BIRTHDAY' } });
        const birthdayDefault = '¡Feliz cumpleaños, {{nombre}}! 🎉 Todo el equipo de la clínica te deseamos un día estupendo. ¡Muchas felicidades!';

        for (const patient of birthdayPatients) {
            if (!patient.phone) { globalStats.birthdays.skipped++; continue; }

            const alreadySent = await prisma.whatsAppLog.findFirst({
                where: { patientId: patient.id, type: 'BIRTHDAY', sentAt: { gte: startOfToday } }
            });
            if (alreadySent) { globalStats.birthdays.skipped++; continue; }

            const content = (birthdayTemplate?.content || birthdayDefault)
                .replace(/{{nombre}}/g, patient.name)
                .replace(/{{PACIENTE}}/g, patient.name);

            let number = patient.phone.replace(/[^0-9]/g, '');
            if (number.length === 9) number = '34' + number;
            const contentWithOptOut = content + '\n\n_Responde "NO" para dejar de recibir avisos_';

            await prisma.whatsAppQueue.create({
                data: { phone: number, message: contentWithOptOut, status: 'PENDING' }
            });
            await prisma.whatsAppLog.create({
                data: { patientId: patient.id, type: 'BIRTHDAY', status: 'PENDING', content: contentWithOptOut, sentAt: new Date() }
            });
            globalStats.birthdays.sent++;
        }

        console.log('[MASTER CRON] ✅ Bloque 2 completado:', globalStats.birthdays);
    } catch (e) {
        console.error('[MASTER CRON] ❌ Error en Bloque 2 (Cumpleaños):', e.message);
    }

    // ── BLOQUE 3: Seguimientos post-operatorios ──────────────────────────────
    try {
        console.log('[MASTER CRON] ▶️ Bloque 3 — Seguimientos...');

        const followupTemplates = await prisma.whatsAppTemplate.findMany({ where: { triggerType: 'TREATMENT_FOLLOWUP' } });

        for (const template of followupTemplates) {
            const offsetDays = parseInt(template.triggerOffset, 10);
            if (isNaN(offsetDays) || offsetDays <= 0) continue;

            const target = new Date();
            target.setDate(target.getDate() - offsetDays);
            const startOfTarget = new Date(new Date(target).setHours(0, 0, 0, 0));
            const endOfTarget   = new Date(new Date(target).setHours(23, 59, 59, 999));

            const appts = await prisma.appointment.findMany({
                where: { status: { in: ['Completed', 'Attended'] }, date: { gte: startOfTarget, lte: endOfTarget } },
                include: { patient: true, treatment: true }
            });

            for (const appt of appts) {
                if (!appt.patient?.phone) { globalStats.followups.skipped++; continue; }

                const alreadySent = await prisma.whatsAppLog.findFirst({
                    where: { patientId: appt.patient.id, type: 'TREATMENT_FOLLOWUP', sentAt: { gte: startOfTarget } }
                });
                if (alreadySent) { globalStats.followups.skipped++; continue; }

                const treatmentName = appt.treatmentName || appt.treatment?.name || 'Consulta';
                const content = template.content
                    .replace(/{{nombre}}/g, appt.patient.name)
                    .replace(/{{PACIENTE}}/g, appt.patient.name)
                    .replace(/{{tratamiento}}/g, treatmentName)
                    .replace(/{{TRATAMIENTO}}/g, treatmentName);

                let number = appt.patient.phone.replace(/[^0-9]/g, '');
                if (number.length === 9) number = '34' + number;
                const contentWithOptOut = content + '\n\n_Responde "NO" para dejar de recibir avisos_';

                await prisma.whatsAppQueue.create({
                    data: { phone: number, message: contentWithOptOut, status: 'PENDING' }
                });
                await prisma.whatsAppLog.create({
                    data: { patientId: appt.patient.id, type: 'TREATMENT_FOLLOWUP', status: 'PENDING', content: contentWithOptOut, sentAt: new Date() }
                });
                globalStats.followups.sent++;
            }
        }

        console.log('[MASTER CRON] ✅ Bloque 3 completado:', globalStats.followups);
    } catch (e) {
        console.error('[MASTER CRON] ❌ Error en Bloque 3 (Seguimientos):', e.message);
    }

    console.log('[MASTER CRON] 🏁 Todos los bloques ejecutados.', globalStats);
    res.json({ message: 'Master Cron finished successfully', stats: globalStats });
});

// ─── CRON: Birthday greetings ─────────────────────────────────────────────────
router.post('/whatsapp-birthdays', async (req, res) => {
    if (!validateCronSecret(req, res)) return;

    try {
        const today = new Date();
        const todayMonth = today.getMonth() + 1;
        const todayDay   = today.getDate();

        const allPatients = await prisma.patient.findMany({
            where: { phone: { not: null } },
            select: { id: true, name: true, phone: true, birthDate: true }
        });

        const birthdayPatients = allPatients.filter(p => {
            if (!p.birthDate) return false;
            const bd = new Date(p.birthDate);
            return bd.getMonth() + 1 === todayMonth && bd.getDate() === todayDay;
        });

        const template = await prisma.whatsAppTemplate.findFirst({ where: { triggerType: 'BIRTHDAY' } });
        const defaultMessage = '¡Feliz cumpleaños, {{nombre}}! 🎉 Todo el equipo de la clínica te deseamos un día estupendo. ¡Muchas felicidades!';
        const stats = { sent: 0, failed: 0, skipped: 0 };

        for (const patient of birthdayPatients) {
            if (!patient.phone) { stats.skipped++; continue; }

            const startOfToday = new Date(today);
            startOfToday.setHours(0, 0, 0, 0);
            const alreadySent = await prisma.whatsAppLog.findFirst({
                where: { patientId: patient.id, type: 'BIRTHDAY', sentAt: { gte: startOfToday } }
            });
            if (alreadySent) { stats.skipped++; continue; }

            const content = (template?.content || defaultMessage)
                .replace(/{{nombre}}/g, patient.name)
                .replace(/{{PACIENTE}}/g, patient.name);

            let number = patient.phone.replace(/[^0-9]/g, '');
            if (number.length === 9) number = '34' + number;
            const contentWithOptOut = content + '\n\n_Responde "NO" para dejar de recibir avisos_';

            await prisma.whatsAppQueue.create({
                data: { phone: number, message: contentWithOptOut, status: 'PENDING' }
            });
            await prisma.whatsAppLog.create({
                data: { patientId: patient.id, type: 'BIRTHDAY', status: 'PENDING', content: contentWithOptOut, sentAt: new Date() }
            });
            stats.sent++;
        }

        res.json({ message: 'Birthday cron finished', stats });
    } catch (e) {
        console.error('[CRON BIRTHDAYS] Error:', e);
        res.status(500).json({ error: e.message });
    }
});

// ─── CRON: Post-op follow-ups ─────────────────────────────────────────────────
router.post('/whatsapp-followups', async (req, res) => {
    if (!validateCronSecret(req, res)) return;

    try {
        const templates = await prisma.whatsAppTemplate.findMany({ where: { triggerType: 'TREATMENT_FOLLOWUP' } });

        if (templates.length === 0) {
            return res.json({ message: 'No followup templates found', stats: { sent: 0, failed: 0, skipped: 0 } });
        }

        const stats = { sent: 0, failed: 0, skipped: 0 };

        for (const template of templates) {
            const offsetDays = parseInt(template.triggerOffset, 10);
            if (isNaN(offsetDays) || offsetDays <= 0) continue;

            const targetDate = new Date();
            targetDate.setDate(targetDate.getDate() - offsetDays);
            const startOfTarget = new Date(new Date(targetDate).setHours(0, 0, 0, 0));
            const endOfTarget   = new Date(new Date(targetDate).setHours(23, 59, 59, 999));

            const appointments = await prisma.appointment.findMany({
                where: { status: { in: ['Completed', 'Attended'] }, date: { gte: startOfTarget, lte: endOfTarget } },
                include: { patient: true, treatment: true }
            });

            for (const appt of appointments) {
                if (!appt.patient?.phone) { stats.skipped++; continue; }

                const alreadySent = await prisma.whatsAppLog.findFirst({
                    where: { patientId: appt.patient.id, type: 'TREATMENT_FOLLOWUP', sentAt: { gte: startOfTarget } }
                });
                if (alreadySent) { stats.skipped++; continue; }

                const treatmentName = appt.treatmentName || appt.treatment?.name || 'Consulta';
                const content = template.content
                    .replace(/{{nombre}}/g, appt.patient.name)
                    .replace(/{{PACIENTE}}/g, appt.patient.name)
                    .replace(/{{tratamiento}}/g, treatmentName)
                    .replace(/{{TRATAMIENTO}}/g, treatmentName);

                let number = appt.patient.phone.replace(/[^0-9]/g, '');
                if (number.length === 9) number = '34' + number;
                const contentWithOptOut = content + '\n\n_Responde "NO" para dejar de recibir avisos_';

                await prisma.whatsAppQueue.create({
                    data: { phone: number, message: contentWithOptOut, status: 'PENDING' }
                });
                await prisma.whatsAppLog.create({
                    data: { patientId: appt.patient.id, type: 'TREATMENT_FOLLOWUP', status: 'PENDING', content: contentWithOptOut, sentAt: new Date() }
                });
                stats.sent++;
            }
        }

        res.json({ message: 'Followup cron finished', stats });
    } catch (e) {
        console.error('[CRON FOLLOWUPS] Error:', e);
        res.status(500).json({ error: e.message });
    }
});

// ─── CRON WORKER: Procesa UN mensaje pendiente de la cola ───────────────────
// Diseñado para Vercel Serverless: cada ejecución dura milisegundos (1 mensaje).
// Se invoca automáticamente cada 2 minutos via vercel.json crons.
router.post('/process-whatsapp-queue', async (req, res) => {
    if (!validateCronSecret(req, res)) return;

    try {
        // Tomar ÚNICAMENTE el mensaje más antiguo en estado PENDING
        const item = await prisma.whatsAppQueue.findFirst({
            where: { status: 'PENDING' },
            orderBy: { createdAt: 'asc' },
        });

        if (!item) {
            return res.json({ message: 'Queue empty', processed: 0 });
        }

        console.log(`[QUEUE WORKER] Procesando mensaje ID: ${item.id} → ${item.phone}`);

        try {
            await whatsappService.sendEvolutionMessage(item.phone, item.message);

            await prisma.whatsAppQueue.update({
                where: { id: item.id },
                data: { status: 'SENT' },
            });

            console.log(`[QUEUE WORKER] ✅ Enviado correctamente. ID: ${item.id}`);
            return res.json({ message: 'Message sent', processed: 1, id: item.id, phone: item.phone });

        } catch (sendErr) {
            const errDetail = sendErr.response?.data
                ? JSON.stringify(sendErr.response.data)
                : sendErr.message;

            await prisma.whatsAppQueue.update({
                where: { id: item.id },
                data: { status: 'FAILED', errorMessage: errDetail },
            });

            console.error(`[QUEUE WORKER] ❌ Fallo al enviar ID: ${item.id} — ${errDetail}`);
            return res.status(200).json({ message: 'Message failed', processed: 1, id: item.id, error: errDetail });
        }

    } catch (e) {
        console.error('[QUEUE WORKER] Error inesperado:', e.message);
        return res.status(500).json({ error: e.message });
    }
});

module.exports = router;
