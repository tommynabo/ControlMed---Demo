/**
 * ─── Test Manual de Envío WhatsApp ───────────────────────────────────────────
 * Uso:
 *   node scripts/test-whatsapp.js +34XXXXXXXXX
 *   node scripts/test-whatsapp.js +34XXXXXXXXX "Mensaje personalizado"
 *
 * Si no se pasa número, se usa el número de prueba de Twilio Sandbox.
 * ─────────────────────────────────────────────────────────────────────────────
 */
require('dotenv').config();

const { sendWhatsAppMessage, formatPhone } = require('../services/whatsappService');

const targetNumber = process.argv[2];
const customMessage = process.argv[3];

if (!targetNumber) {
    console.error('\x1b[31mUso: node scripts/test-whatsapp.js +34XXXXXXXXX ["Mensaje opcional"]\x1b[0m');
    process.exit(1);
}

// Mensaje de prueba que simula exactamente el formato que usará el cron de recordatorios
const testMessage = customMessage || `Hola, [Nombre Paciente]. Le recordamos que tiene una cita en nuestra clínica el día [DD/MM/YYYY] a las [HH:MM] con el Dr. [Nombre Doctor]. Si necesita cambiar la cita, llámenos. Gracias.`;

const formattedNumber = formatPhone(targetNumber);
console.log(`\n📱 Número original:   ${targetNumber}`);
console.log(`📱 Número formateado: ${formattedNumber}`);
console.log(`💬 Mensaje:\n${testMessage}\n`);
console.log('Enviando...\n');

sendWhatsAppMessage(formattedNumber, testMessage)
    .then((result) => {
        console.log('\x1b[32m✅ Mensaje enviado correctamente\x1b[0m');
        console.log('SID de Twilio:', result.sid);
        console.log('\nVerifica el estado en: https://console.twilio.com/us1/monitor/logs/sms');
        process.exit(0);
    })
    .catch((err) => {
        console.error('\x1b[31m❌ Error al enviar:\x1b[0m', err.message);
        if (err.code) console.error('Código Twilio:', err.code);
        if (err.moreInfo) console.error('Más info:', err.moreInfo);
        process.exit(1);
    });
