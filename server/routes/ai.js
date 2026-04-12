'use strict';
const express = require('express');
const aiAgent = require('../services/aiAgent');

const router = express.Router();

// POST /api/ai/query (aiLimiter applied at mount point in index.js)
router.post('/query', async (req, res) => {
    try {
        const { message, context } = req.body;
        const userInfo = {
            id: req.user.id,
            role: req.user.role,
            doctorId: req.user.doctorId || null,
            activePatientId: context?.patientId
        };
        const response = await aiAgent.processQuery(message, userInfo, context);
        res.json(response);
    } catch (e) {
        console.error('AI Query Error:', e);
        res.status(500).json({ error: e.message });
    }
});

// POST /api/ai/improve
router.post('/improve', async (req, res) => {
    try {
        const { text, patientName, type } = req.body;
        if (!text) return res.status(400).json({ error: 'Text is required' });

        const improved = await aiAgent.improveMessage(text, patientName, type);
        res.json({ text: improved });
    } catch (e) {
        console.error('AI Improve Error:', e);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
