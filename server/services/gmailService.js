'use strict';
const { google } = require('googleapis');
const { getSupabase } = require('../lib/db');

const SCOPES = [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/userinfo.email',
];

// ─── OAuth2 Client factory ────────────────────────────────────────────────────
function createOAuth2Client() {
    return new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
    );
}

// ─── Fetch clinic row from Supabase ──────────────────────────────────────────
async function getClinicRow() {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('clinic_info')
        .select('id, gmail_refresh_token, gmail_connected_email')
        .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
}

// ─── Generate OAuth URL ───────────────────────────────────────────────────────
function getAuthUrl() {
    const oauth2Client = createOAuth2Client();
    return oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent', // Force refresh_token on every auth
    });
}

// ─── Handle OAuth callback code → store tokens ───────────────────────────────
async function handleCallback(code) {
    const oauth2Client = createOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Retrieve the connected email address
    const oauth2Api = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: userInfo } = await oauth2Api.userinfo.get();
    const connectedEmail = userInfo.email;

    const supabase = getSupabase();
    const clinic = await getClinicRow();

    if (clinic) {
        // Only overwrite gmail_refresh_token when Google returns a new one.
        // Google omits refresh_token on re-authorisations unless the user explicitly
        // revokes access first; writing undefined/null would wipe the stored token.
        const updateData = { gmail_connected_email: connectedEmail };
        if (tokens.refresh_token) updateData.gmail_refresh_token = tokens.refresh_token;
        await supabase
            .from('clinic_info')
            .update(updateData)
            .eq('id', clinic.id);
    } else {
        // No clinic row yet — create one with just the Gmail fields
        await supabase.from('clinic_info').insert([{
            gmail_refresh_token: tokens.refresh_token || null,
            gmail_connected_email: connectedEmail,
        }]);
    }

    return connectedEmail;
}

// ─── Status ───────────────────────────────────────────────────────────────────
async function getStatus() {
    const clinic = await getClinicRow();
    if (!clinic || !clinic.gmail_refresh_token) {
        return { connected: false, email: null };
    }
    return { connected: true, email: clinic.gmail_connected_email };
}

// ─── Revoke / Disconnect ──────────────────────────────────────────────────────
async function revokeAccess() {
    const supabase = getSupabase();
    const clinic = await getClinicRow();
    if (!clinic) return;
    await supabase
        .from('clinic_info')
        .update({ gmail_refresh_token: null, gmail_connected_email: null })
        .eq('id', clinic.id);
}

// ─── Send email via Gmail API ─────────────────────────────────────────────────
/**
 * @param {{ to: string, subject: string, htmlBody: string, attachments?: Array<{ filename: string, content: Buffer, mimeType?: string }> }} options
 */
async function sendGmail({ to, subject, htmlBody, attachments = [] }) {
    const clinic = await getClinicRow();
    if (!clinic || !clinic.gmail_refresh_token) {
        throw new Error('Gmail no está conectado. Conecta una cuenta en Configuración > Gmail.');
    }

    const oauth2Client = createOAuth2Client();
    oauth2Client.setCredentials({ refresh_token: clinic.gmail_refresh_token });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Build a multipart/mixed RFC 2822 message
    const boundary = `crm_boundary_${Date.now()}`;
    const lines = [];

    lines.push(`To: ${to}`);
    lines.push(`Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`);
    lines.push('MIME-Version: 1.0');
    lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
    lines.push('');

    // HTML body part
    lines.push(`--${boundary}`);
    lines.push('Content-Type: text/html; charset=UTF-8');
    lines.push('Content-Transfer-Encoding: base64');
    lines.push('');
    lines.push(Buffer.from(htmlBody).toString('base64'));

    // Attachment parts
    for (const att of attachments) {
        const mime = att.mimeType || 'application/pdf';
        const content = Buffer.isBuffer(att.content) ? att.content : Buffer.from(att.content);
        lines.push(`--${boundary}`);
        lines.push(`Content-Type: ${mime}; name="${att.filename}"`);
        lines.push('Content-Transfer-Encoding: base64');
        lines.push(`Content-Disposition: attachment; filename="${att.filename}"`);
        lines.push('');
        lines.push(content.toString('base64'));
    }

    lines.push(`--${boundary}--`);

    const raw = Buffer.from(lines.join('\r\n'))
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

    await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw },
    });
}

module.exports = { getAuthUrl, handleCallback, getStatus, revokeAccess, sendGmail };
