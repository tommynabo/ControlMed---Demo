'use strict';
const express = require('express');
const { prisma } = require('../lib/db');
const whatsappService = require('../services/whatsappService');
const templateService = require('../services/templateService');

const router = express.Router();

// ─── Status & QR ─────────────────────────────────────────────────────────────
router.get('/status', async (req, res) => {
    res.json(await whatsappService.getStatus());
});

router.get('/qr', async (req, res) => {
    try {
        const qr = await whatsappService.getQrCode();
        res.json({ qrCode: qr });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── Send test message ────────────────────────────────────────────────────────
router.post('/send-test', async (req, res) => {
    try {
        const { phone, message } = req.body;
        const response = await whatsappService.sendMessage(phone, message || 'Test message from CRM Medico');
        res.json(response);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── Logout ───────────────────────────────────────────────────────────────────
router.post('/logout', async (req, res) => {
    const result = await whatsappService.logout();
    res.json(result);
});

// ─── Schedule message ─────────────────────────────────────────────────────────
router.post('/schedule', async (req, res) => {
    try {
        const { patientId, content, scheduledDate } = req.body;
        const log = await prisma.whatsAppLog.create({
            data: { patientId, type: 'TREATMENT_FOLLOWUP', status: 'PENDING', content, scheduledFor: new Date(scheduledDate), sentAt: new Date(scheduledDate) }
        });
        res.json(log);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── Templates ────────────────────────────────────────────────────────────────
router.get('/templates', async (req, res) => {
    try {
        const templates = await prisma.whatsAppTemplate.findMany();
        res.json(templates);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/templates', async (req, res) => {
    try {
        const { name, content, triggerType, triggerOffset } = req.body;
        const t = await prisma.whatsAppTemplate.create({ data: { name, content, triggerType, triggerOffset } });
        res.json(t);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/templates/:id', async (req, res) => {
    try {
        await prisma.whatsAppTemplate.delete({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── Logs ─────────────────────────────────────────────────────────────────────
router.get('/logs', async (req, res) => {
    try {
        const { patientId } = req.query;
        const where = patientId ? { patientId } : {};
        const logs = await prisma.whatsAppLog.findMany({
            where,
            orderBy: { sentAt: 'desc' },
            take: 100,
            include: { patient: true }
        });
        res.json(logs);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
