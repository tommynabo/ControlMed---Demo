'use strict';
/**
 * Public signing router — no auth middleware applied.
 * Mounted at /api/sign by server/index.js.
 *
 * GET  /api/sign/:token       — validate token, return consent + patient data
 * POST /api/sign/:token       — receive signature + PDF, store in Supabase Storage, mark signed
 */
const express = require('express');
const router = express.Router();
const { prisma, getSupabase } = require('../lib/db');
const gmailService = require('../services/gmailService');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Base64-encoded data URL → Buffer + mime type
 * Handles both "data:image/png;base64,..." and raw base64 strings.
 */
function dataUrlToBuffer(dataUrl) {
    if (!dataUrl) throw new Error('dataUrl is required');
    const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (matches) {
        return { buffer: Buffer.from(matches[2], 'base64'), mime: matches[1] };
    }
    // Raw base64 — assume PDF
    return { buffer: Buffer.from(dataUrl, 'base64'), mime: 'application/pdf' };
}

async function uploadToStorage(supabase, path, buffer, mime) {
    const { data, error } = await supabase.storage
        .from('consent-files')
        .upload(path, buffer, { contentType: mime, upsert: true });
    if (error) throw new Error(`Storage upload failed (${path}): ${error.message}`);
    return data;
}

// ─── GET /api/sign/:token ─────────────────────────────────────────────────────
router.get('/:token', async (req, res) => {
    try {
        const { token } = req.params;

        const consent = await prisma.consent.findFirst({
            where: { signToken: token },
            include: { patient: { select: { name: true, dni: true, birthDate: true } } }
        });

        if (!consent) {
            return res.status(404).json({ error: 'Enlace no válido o ya utilizado.' });
        }
        if (consent.isSigned) {
            return res.status(410).json({ error: 'Este documento ya ha sido firmado.' });
        }
        if (!consent.signTokenExpiresAt || new Date() > consent.signTokenExpiresAt) {
            return res.status(410).json({ error: 'El enlace ha caducado. Solicita uno nuevo en la clínica.' });
        }

        res.json({
            consentId: consent.id,
            templateId: consent.templateId,
            title: consent.title,
            expiresAt: consent.signTokenExpiresAt,
            patient: {
                name: consent.patient?.name || '',
                dni: consent.patient?.dni || '',
                birthDate: consent.patient?.birthDate
                    ? new Date(consent.patient.birthDate).toLocaleDateString('es-ES')
                    : ''
            }
        });
    } catch (e) {
        console.error('[sign] GET error:', e);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ─── POST /api/sign/:token ────────────────────────────────────────────────────
router.post('/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const { signatureBase64, signedPdfBase64 } = req.body;

        if (!signatureBase64 || !signedPdfBase64) {
            return res.status(400).json({ error: 'signatureBase64 y signedPdfBase64 son obligatorios.' });
        }

        // Re-validate token
        const consent = await prisma.consent.findFirst({
            where: { signToken: token },
            include: { patient: { select: { name: true, email: true } } }
        });

        if (!consent) return res.status(404).json({ error: 'Enlace no válido o ya utilizado.' });
        if (consent.isSigned) return res.status(410).json({ error: 'Este documento ya ha sido firmado.' });
        if (!consent.signTokenExpiresAt || new Date() > consent.signTokenExpiresAt) {
            return res.status(410).json({ error: 'El enlace ha caducado.' });
        }

        // Upload to Supabase Storage
        const supabase = getSupabase();

        const sigData = dataUrlToBuffer(signatureBase64);
        const pdfData = dataUrlToBuffer(signedPdfBase64);

        await uploadToStorage(supabase, `signatures/${consent.id}.png`, sigData.buffer, 'image/png');
        await uploadToStorage(supabase, `pdfs/${consent.id}.pdf`, pdfData.buffer, 'application/pdf');

        // Generate signed (temporary) read URLs — valid 1 year for archival
        const SIGNED_URL_EXPIRY = 365 * 24 * 3600; // seconds

        const { data: sigUrl } = await supabase.storage
            .from('consent-files')
            .createSignedUrl(`signatures/${consent.id}.png`, SIGNED_URL_EXPIRY);

        const { data: pdfUrl } = await supabase.storage
            .from('consent-files')
            .createSignedUrl(`pdfs/${consent.id}.pdf`, SIGNED_URL_EXPIRY);

        // Mark consent as signed and clear token
        const updated = await prisma.consent.update({
            where: { id: consent.id },
            data: {
                isSigned: true,
                signedDate: new Date(),
                signToken: null,
                signTokenExpiresAt: null,
                signatureImageUrl: sigUrl?.signedUrl || null,
                signedPdfUrl: pdfUrl?.signedUrl || null
            }
        });

        // Fire-and-forget email to patient
        if (consent.patient?.email) {
            (async () => {
                try {
                    const signedDate = new Date().toLocaleString('es-ES');
                    await gmailService.sendGmail({
                        to: consent.patient.email,
                        subject: 'Copia de su consentimiento firmado digitalmente',
                        htmlBody: `
                            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1e293b;">
                                <h2 style="color:#7c3aed;">Consentimiento Informado Firmado Digitalmente</h2>
                                <p>Estimado/a <strong>${consent.patient.name}</strong>,</p>
                                <p>Le confirmamos que ha firmado digitalmente su consentimiento informado en nuestra clínica.</p>
                                <table style="width:100%;border-collapse:collapse;margin:20px 0;">
                                    <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;"><strong>Documento:</strong></td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">${updated.title}</td></tr>
                                    <tr><td style="padding:8px;"><strong>Fecha de firma:</strong></td><td style="padding:8px;">${signedDate}</td></tr>
                                </table>
                                <p style="color:#64748b;font-size:13px;">Guarde este correo como comprobante. Si tiene alguna pregunta, contacte con la clínica.</p>
                            </div>`
                    });
                } catch (mailErr) {
                    console.warn('[sign] Email send failed (non-critical):', mailErr.message);
                }
            })();
        }

        res.json({ success: true, consentId: consent.id });
    } catch (e) {
        console.error('[sign] POST error:', e);
        res.status(500).json({ error: 'Error al guardar la firma. Inténtalo de nuevo.' });
    }
});

module.exports = router;
