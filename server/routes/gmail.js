'use strict';
const express = require('express');
const gmailService = require('../services/gmailService');

const router = express.Router();

// GET /api/gmail/status — JWT protected (via global authMiddleware)
router.get('/status', async (req, res) => {
    try {
        const status = await gmailService.getStatus();
        res.json(status);
    } catch (e) {
        console.error('Gmail status error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// GET /api/gmail/auth-url — JWT protected
router.get('/auth-url', async (req, res) => {
    try {
        const url = gmailService.getAuthUrl();
        res.json({ url });
    } catch (e) {
        console.error('Gmail auth-url error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// GET /api/gmail/callback — PUBLIC (Google redirects here)
// authMiddleware is bypassed for this path in index.js PUBLIC_PATHS
router.get('/callback', async (req, res) => {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    try {
        const { code, error } = req.query;
        if (error) {
            console.warn('Gmail OAuth error from Google:', error);
            return res.redirect(`${frontendUrl}/settings?tab=gmail&error=access_denied`);
        }
        if (!code) {
            return res.redirect(`${frontendUrl}/settings?tab=gmail&error=missing_code`);
        }
        await gmailService.handleCallback(String(code));
        res.redirect(`${frontendUrl}/settings?tab=gmail&connected=true`);
    } catch (e) {
        console.error('Gmail callback error:', e.message);
        res.redirect(`${frontendUrl}/settings?tab=gmail&error=auth_failed`);
    }
});

// DELETE /api/gmail/disconnect — JWT protected
router.delete('/disconnect', async (req, res) => {
    try {
        await gmailService.revokeAccess();
        res.json({ success: true });
    } catch (e) {
        console.error('Gmail disconnect error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
