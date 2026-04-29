'use strict';
const express = require('express');
const axios = require('axios');
const gmailService = require('../services/gmailService');
const { getSupabase } = require('../lib/db');
const { getFreshPdfUrl } = require('../services/invoiceService');

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

// POST /api/gmail/send-invoice — JWT protected
router.post('/send-invoice', async (req, res) => {
    try {
        const { invoiceId } = req.body;
        if (!invoiceId) {
            return res.status(400).json({ error: 'invoiceId es requerido' });
        }

        const supabase = getSupabase();

        // 1. Fetch invoice
        const { data: invoice, error: invError } = await supabase
            .from('Invoice')
            .select('id, invoiceNumber, url, patientId')
            .eq('id', invoiceId)
            .single();
        if (invError || !invoice) {
            return res.status(404).json({ error: 'Factura no encontrada' });
        }

        // 2. Fetch patient
        const { data: patient, error: patError } = await supabase
            .from('Patient')
            .select('id, name, email')
            .eq('id', invoice.patientId)
            .single();
        if (patError || !patient) {
            return res.status(404).json({ error: 'Paciente no encontrado' });
        }

        // 3. Validate patient email
        if (!patient.email || !patient.email.trim()) {
            return res.status(400).json({ error: 'El paciente no tiene un correo asignado' });
        }

        // 4. Get PDF URL (use stored or fetch fresh)
        let pdfUrl = invoice.url || null;
        if (!pdfUrl) {
            pdfUrl = await getFreshPdfUrl(invoice.invoiceNumber);
        }
        if (!pdfUrl) {
            return res.status(400).json({ error: 'No se pudo obtener el PDF de la factura' });
        }

        // 5. Download PDF as buffer
        const pdfResponse = await axios.get(pdfUrl, { responseType: 'arraybuffer', timeout: 15000 });
        const pdfBuffer = Buffer.from(pdfResponse.data);

        // 6. Build email content
        const subject = `Tu factura de CHC Clínica Dental - ${invoice.invoiceNumber}`;
        const htmlBody = `<div style="font-family: Arial, sans-serif; color: #333;">
  <p>Hola <strong>${patient.name}</strong>,</p>
  <p>Adjunto a este correo encontrarás la factura correspondiente a tu tratamiento.</p>
  <p>Si tienes alguna consulta, no dudes en contactarnos.</p>
  <br>
  <p>Gracias por confiar en nuestro equipo,</p>
  <p><strong>CHC Clínica Dental</strong></p>
</div>`;

        // 7. Send via Gmail
        await gmailService.sendGmail({
            to: patient.email.trim(),
            subject,
            htmlBody,
            attachments: [{
                filename: `Factura-${invoice.invoiceNumber}.pdf`,
                content: pdfBuffer,
                mimeType: 'application/pdf',
            }],
        });

        console.log(`✅ Invoice ${invoice.invoiceNumber} sent to ${patient.email}`);
        res.json({ success: true });

    } catch (e) {
        console.error('Gmail send-invoice error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
