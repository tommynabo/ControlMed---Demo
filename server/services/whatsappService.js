// ─── WhatsApp Service (Evolution API) ────────────────────────────────────────
// Envío de mensajes WhatsApp a través de Evolution API (self-hosted o cloud).
// Variables de entorno requeridas:
//   EVOLUTION_API_URL      — URL base de la instancia (ej: https://evolution.midominio.com)
//   EVOLUTION_API_KEY      — API Key de autenticación
//   EVOLUTION_INSTANCE     — Nombre de la instancia configurada en Evolution
// ─────────────────────────────────────────────────────────────────────────────
require('dotenv').config();

const axios = require('axios');

const EVOLUTION_API_URL  = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY  = process.env.EVOLUTION_API_KEY;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE;

if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE) {
    console.warn('\x1b[33m%s\x1b[0m', '[WhatsApp] EVOLUTION_API_URL, EVOLUTION_API_KEY o EVOLUTION_INSTANCE no definidos. El servicio no enviará mensajes.');
}

// ─── Formateo de teléfono ─────────────────────────────────────────────────────
/**
 * Normaliza un número de teléfono a formato E.164 asumiendo España (+34) como
 * prefijo por defecto cuando el número no incluye código de país.
 *
 * Ejemplos:
 *   "612 345 678"  → "+34612345678"
 *   "0034612345678"→ "+34612345678"
 *   "+34612345678" → "+34612345678"
 *   "+1415XXXXXXX" → "+1415XXXXXXX"  (se respeta el prefijo existente)
 */
const formatPhone = (phone) => {
    if (!phone) return null;
    // Quitar espacios, guiones y paréntesis
    let normalized = String(phone).replace(/[\s\-().]/g, '');
    // Convertir prefijo 0034 → +34
    if (normalized.startsWith('0034')) {
        normalized = '+' + normalized.slice(2);
    }
    // Si no empieza con + asumir España
    if (!normalized.startsWith('+')) {
        normalized = '+34' + normalized;
    }
    return normalized;
};

// ─── Función central de envío ─────────────────────────────────────────────────
/**
 * Envía un mensaje de texto a través de Evolution API.
 * @param {string} to    - Número destino (cualquier formato; se normaliza internamente)
 * @param {string} text  - Texto del mensaje
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
const sendEvolutionMessage = async (to, text) => {
    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE) {
        throw new Error('Evolution API no configurada. Verifica EVOLUTION_API_URL, EVOLUTION_API_KEY y EVOLUTION_INSTANCE en .env');
    }

    const formattedTo = formatPhone(to);
    if (!formattedTo) {
        throw new Error(`Número de teléfono inválido: ${to}`);
    }

    const url = `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`;

    const response = await axios.post(
        url,
        {
            number: formattedTo,
            options: { delay: 1200, presence: 'composing' },
            textMessage: { text },
        },
        {
            headers: {
                'apikey': EVOLUTION_API_KEY,
                'Content-Type': 'application/json',
            },
            timeout: 15000,
        }
    );

    return { success: true, messageId: response.data?.key?.id };
};

// ─── API pública (compatible con schedulerService y rutas existentes) ─────────

/**
 * Envía un mensaje de WhatsApp con manejo de errores no-bloqueante.
 * Los errores de Evolution API se loguean en rojo pero NO lanzan excepción,
 * para no interrumpir el bucle del cron job.
 */
const sendMessage = async (to, body) => {
    try {
        const result = await sendEvolutionMessage(to, body);
        console.log(`\x1b[32m[WhatsApp] ✅ Enviado a ${to} — ID: ${result.messageId}\x1b[0m`);
        return result;
    } catch (err) {
        const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
        console.error(`\x1b[31m[WhatsApp] ❌ Error al enviar a ${to}: ${detail}\x1b[0m`);
        return { success: false, error: detail };
    }
};

const initialize = async () => {
    if (EVOLUTION_API_URL && EVOLUTION_API_KEY && EVOLUTION_INSTANCE) {
        console.log(`[WhatsApp] Servicio Evolution API inicializado. Instancia: ${EVOLUTION_INSTANCE}`);
    }
};

const getStatus = async () => {
    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE) {
        return { status: 'NOT_CONFIGURED', qrCode: null, provider: 'Evolution API' };
    }

    try {
        const url = `${EVOLUTION_API_URL}/instance/connectionState/${EVOLUTION_INSTANCE}`;
        const response = await axios.get(url, {
            headers: { 'apikey': EVOLUTION_API_KEY },
            timeout: 10000,
        });

        // Evolution API v2: { instance: { state: 'open' | 'close' | 'connecting' } }
        const state = response.data?.instance?.state || response.data?.state || 'close';

        let status;
        if (state === 'open') status = 'AUTHENTICATED';
        else if (state === 'connecting') status = 'INITIALIZING';
        else status = 'DISCONNECTED';

        return { status, qrCode: null, provider: 'Evolution API', evolutionState: state };
    } catch (e) {
        console.error('[WhatsApp] Error fetching connection state:', e.message);
        return { status: 'DISCONNECTED', qrCode: null, provider: 'Evolution API' };
    }
};

const getQrCode = async () => {
    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE) {
        throw new Error('Evolution API no configurada. Verifica EVOLUTION_API_URL, EVOLUTION_API_KEY y EVOLUTION_INSTANCE en Vercel.');
    }

    const url = `${EVOLUTION_API_URL}/instance/connect/${EVOLUTION_INSTANCE}`;

    let response;
    try {
        response = await axios.get(url, {
            headers: { 'apikey': EVOLUTION_API_KEY },
            timeout: 15000,
        });
    } catch (axiosErr) {
        const status = axiosErr.response?.status;
        const detail = axiosErr.response?.data
            ? JSON.stringify(axiosErr.response.data)
            : axiosErr.message;
        throw new Error(`Evolution API error ${status || ''}: ${detail}`);
    }

    // Evolution API v2: base64 directo o anidado bajo qrcode
    const base64 = response.data?.base64 || response.data?.qrcode?.base64 || null;

    if (!base64) {
        // La instancia ya puede estar conectada (state: open) — no hay QR disponible
        const state = response.data?.instance?.state || response.data?.state || 'unknown';
        throw new Error(`No hay QR disponible. Estado de la instancia: "${state}". Si ya está conectada, haz logout primero.`);
    }

    return base64;
};

const logout = async () => {
    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE) {
        return { success: false, error: 'Evolution API no configurada' };
    }

    try {
        const url = `${EVOLUTION_API_URL}/instance/logout/${EVOLUTION_INSTANCE}`;
        await axios.delete(url, {
            headers: { 'apikey': EVOLUTION_API_KEY },
            timeout: 10000,
        });
        console.log('[WhatsApp] Logout exitoso de Evolution API.');
        return { success: true };
    } catch (e) {
        const detail = e.response?.data ? JSON.stringify(e.response.data) : e.message;
        console.error('[WhatsApp] Error en logout:', detail);
        return { success: false, error: detail };
    }
};

module.exports = {
    initialize,
    getStatus,
    getQrCode,
    sendMessage,
    sendEvolutionMessage, // exportada para uso directo en el worker de la cola
    formatPhone,          // exportada para poder testear el formateo de teléfonos
    logout,
};
