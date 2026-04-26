// ─── WhatsApp Service ─────────────────────────────────────────────────────────
// TODO: Migración a Twilio WhatsApp API pendiente.
// La lógica de negocio (cron.js, reminders.js) llama a estas funciones;
// la implementación real se añadirá en la siguiente fase.
// ─────────────────────────────────────────────────────────────────────────────

const initialize = async () => {
    console.log('[WhatsApp] Servicio pendiente de migración a Twilio. initialize() no operativo.');
};

const getStatus = async () => {
    return { status: 'PENDING_MIGRATION', qrCode: null, provider: 'Twilio (pendiente)' };
};

const getQrCode = async () => {
    console.log('[WhatsApp] getQrCode() no disponible — migración a Twilio pendiente.');
    return null;
};

const sendMessage = async (to, message) => {
    console.log(`[WhatsApp] sendMessage() pendiente de migración. Destinatario: ${to}. Mensaje: ${message}`);
    // TODO: implementar envío real con Twilio WhatsApp API
    return { success: false, error: 'PENDING_MIGRATION' };
};

const logout = async () => {
    console.log('[WhatsApp] logout() no disponible — migración a Twilio pendiente.');
    return { success: false, error: 'PENDING_MIGRATION' };
};

module.exports = {
    initialize,
    getStatus,
    getQrCode,
    sendMessage,
    logout
};
