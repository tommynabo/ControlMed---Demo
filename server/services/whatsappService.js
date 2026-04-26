// ─── WhatsApp Service (Twilio) ────────────────────────────────────────────────
// Envío de mensajes WhatsApp a través de la API oficial de Twilio.
// IMPORTANTE: La API de Meta impone la regla de las 24h.
//   - Para iniciar conversaciones (recordatorios) se deben usar plantillas
//     pre-aprobadas en la cuenta de Twilio/Meta Business Manager.
//   - Los mensajes de respuesta dentro de una ventana de 24h pueden ser libres.
// ─────────────────────────────────────────────────────────────────────────────
require('dotenv').config();

const twilio = require('twilio');

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN  = process.env.TWILIO_AUTH_TOKEN;
const FROM_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER;

// Inicializar cliente Twilio al cargar el módulo.
// Si faltan las variables de entorno, el módulo sigue cargando pero los envíos fallarán con error claro.
let client = null;
if (ACCOUNT_SID && AUTH_TOKEN) {
    client = twilio(ACCOUNT_SID, AUTH_TOKEN);
} else {
    console.warn('\x1b[33m%s\x1b[0m', '[WhatsApp] TWILIO_ACCOUNT_SID o TWILIO_AUTH_TOKEN no definidos. El servicio no enviará mensajes.');
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
 * Envía un mensaje de WhatsApp usando la API de Twilio.
 * @param {string} to    - Número destino (cualquier formato; se normaliza internamente)
 * @param {string} body  - Texto del mensaje (debe coincidir exactamente con la plantilla aprobada
 *                         si se abre una conversación nueva — regla 24h de Meta)
 * @returns {Promise<{success: boolean, sid?: string, error?: string}>}
 */
const sendWhatsAppMessage = async (to, body) => {
    if (!client) {
        throw new Error('Cliente Twilio no inicializado. Verifica TWILIO_ACCOUNT_SID y TWILIO_AUTH_TOKEN en .env');
    }
    const formattedTo = formatPhone(to);
    if (!formattedTo) {
        throw new Error(`Número de teléfono inválido: ${to}`);
    }

    const message = await client.messages.create({
        from: `whatsapp:${FROM_NUMBER}`,
        to:   `whatsapp:${formattedTo}`,
        body: body,
    });

    return { success: true, sid: message.sid };
};

// ─── API pública (compatible con schedulerService y rutas existentes) ─────────

/**
 * Envía un mensaje de WhatsApp con manejo de errores no-bloqueante.
 * Los errores de Twilio (número inválido, plantilla no aprobada, etc.) se loguean
 * en rojo pero NO lanzan excepción, para no interrumpir el bucle del cron job.
 */
const sendMessage = async (to, body) => {
    try {
        const result = await sendWhatsAppMessage(to, body);
        console.log(`\x1b[32m[WhatsApp] ✅ Enviado a ${to} — SID: ${result.sid}\x1b[0m`);
        return result;
    } catch (err) {
        console.error(`\x1b[31m[WhatsApp] ❌ Error al enviar a ${to}: ${err.message}\x1b[0m`);
        return { success: false, error: err.message };
    }
};

const initialize = async () => {
    if (client) {
        console.log('[WhatsApp] Servicio Twilio inicializado correctamente.');
    }
};

const getStatus = async () => {
    return {
        status: client ? 'READY' : 'NOT_CONFIGURED',
        qrCode: null,
        provider: 'Twilio WhatsApp API',
    };
};

const getQrCode = async () => {
    // Twilio no usa QR — se mantiene por compatibilidad con rutas existentes
    return null;
};

const logout = async () => {
    // No hay sesión que cerrar en Twilio — se mantiene por compatibilidad
    return { success: true };
};

module.exports = {
    initialize,
    getStatus,
    getQrCode,
    sendMessage,
    sendWhatsAppMessage, // exportada también para pruebas manuales y uso directo
    formatPhone,         // exportada para poder testear el formateo de teléfonos
    logout,
};
