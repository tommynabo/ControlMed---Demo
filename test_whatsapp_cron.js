/**
 * test_whatsapp_cron.js
 * Simula la lógica del cron de recordatorios WhatsApp SIN enviar nada.
 * Muestra exactamente qué citas serían procesadas en este momento.
 *
 * Uso: node test_whatsapp_cron.js
 * Uso (ventana custom): node test_whatsapp_cron.js --hoursAhead 12
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── Parámetro opcional --hoursAhead N (por defecto 12) ─────────────────────
const hoursAheadArg = process.argv.indexOf('--hoursAhead');
const TARGET_HOURS  = hoursAheadArg !== -1 ? parseInt(process.argv[hoursAheadArg + 1], 10) : 12;

// ── Misma lógica que cron.js ────────────────────────────────────────────────
const now         = Date.now();
const startWindow = new Date(now + (TARGET_HOURS - 1) * 60 * 60 * 1000);
const endWindow   = new Date(now + (TARGET_HOURS + 1) * 60 * 60 * 1000);

const candidateStart = new Date(now +  8 * 60 * 60 * 1000);
const candidateEnd   = new Date(now + 30 * 60 * 60 * 1000);

const getSpainUTCOffset = (dateStr) => {
    const ref   = new Date(`${dateStr}T12:00:00Z`);
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Europe/Madrid', hour: '2-digit', hour12: false,
    }).formatToParts(ref);
    return parseInt(parts.find(p => p.type === 'hour').value, 10) - 12;
};

const apptToUTC = (appt) => {
    if (!appt.time) return null;
    const dateStr  = new Date(appt.date).toISOString().split('T')[0];
    const [hh, mm] = appt.time.substring(0, 5).split(':').map(Number);
    const offset   = getSpainUTCOffset(dateStr);
    const apptUTC  = new Date(`${dateStr}T00:00:00Z`);
    apptUTC.setUTCHours(hh - offset, mm, 0, 0);
    return apptUTC;
};

const renderMessage = (appt, template) => {
    const dateStr     = new Date(appt.date).toISOString().split('T')[0];
    const offset      = getSpainUTCOffset(dateStr);
    const apptUTC     = apptToUTC(appt);
    const formattedDate = apptUTC.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Madrid' });
    const formattedTime = appt.time ? appt.time.substring(0, 5) : '';
    const treatmentLabel = appt.treatment_name ? ` — ${appt.treatment_name}` : '';

    return template
        .replace(/{{nombre}}/g,      appt.patient_name || '')
        .replace(/{{fecha}}/g,       formattedDate)
        .replace(/{{hora}}/g,        formattedTime)
        .replace(/{{tratamiento}}/g, treatmentLabel);
};

// ── Colores de consola ──────────────────────────────────────────────────────
const c = {
    green:  s => `\x1b[32m${s}\x1b[0m`,
    red:    s => `\x1b[31m${s}\x1b[0m`,
    yellow: s => `\x1b[33m${s}\x1b[0m`,
    cyan:   s => `\x1b[36m${s}\x1b[0m`,
    bold:   s => `\x1b[1m${s}\x1b[0m`,
    dim:    s => `\x1b[2m${s}\x1b[0m`,
};

async function main() {
    console.log('\n' + c.bold('══════════════════════════════════════════════════'));
    console.log(c.bold('  TEST CRON WHATSAPP — Diagnóstico (dry-run)'));
    console.log(c.bold('══════════════════════════════════════════════════'));
    console.log(c.dim(`  Ahora UTC:         ${new Date(now).toISOString()}`));
    console.log(c.dim(`  Ventana objetivo:  ±1h alrededor de +${TARGET_HOURS}h`));
    console.log(c.dim(`  startWindow:       ${startWindow.toISOString()}`));
    console.log(c.dim(`  endWindow:         ${endWindow.toISOString()}`));
    console.log(c.dim(`  SQL candidatos:    ${candidateStart.toISOString()} → ${candidateEnd.toISOString()}`));

    // ── 1. Estado del motor ─────────────────────────────────────────────────
    console.log('\n' + c.bold('1. Estado del motor'));
    const motorStatus = process.env.WHATSAPP_ENABLED;
    if (motorStatus === 'true') {
        console.log('   ' + c.green('✅ WHATSAPP_ENABLED=true  →  Motor ACTIVO'));
    } else {
        console.log('   ' + c.yellow(`⏸️  WHATSAPP_ENABLED=${motorStatus ?? 'no definido'}  →  Motor PAUSADO`));
        console.log(c.dim('   (Este test continúa de todas formas para mostrar qué procesaría)'));
    }

    // ── 2. Template activo ──────────────────────────────────────────────────
    console.log('\n' + c.bold('2. Template APPOINTMENT_REMINDER'));
    const { data: templates, error: tErr } = await supabase
        .from('WhatsAppTemplate')
        .select('*')
        .eq('triggerType', 'APPOINTMENT_REMINDER');

    if (tErr || !templates?.length) {
        console.log('   ' + c.red('❌ No se encontró template — los mensajes fallarán'));
        return;
    }
    const template = templates[0];
    const hasPlaceholders = ['{{nombre}}', '{{fecha}}', '{{hora}}'].every(p => template.content.includes(p));
    if (hasPlaceholders) {
        console.log('   ' + c.green('✅ Template OK — contiene {{nombre}}, {{fecha}}, {{hora}}'));
    } else {
        console.log('   ' + c.red('❌ Template SIN placeholders — todos recibirían el mismo texto fijo'));
    }
    console.log(c.dim(`   Contenido: "${template.content.substring(0, 100)}..."`));

    // ── 3. Candidatos SQL ───────────────────────────────────────────────────
    console.log('\n' + c.bold('3. Candidatos de la BD (ventana SQL amplia)'));
    const { data: candidates, error: cErr } = await supabase
        .from('Appointment')
        .select(`
            id, date, time, status, whatsapp_sent,
            patient:patientId ( id, name, phone ),
            treatment:treatmentId ( name )
        `)
        .in('status', ['Scheduled', 'Confirmed'])
        .gte('date', candidateStart.toISOString())
        .lte('date', candidateEnd.toISOString())
        .eq('whatsapp_sent', false)
        .is('deleted_at', null);

    if (cErr) {
        console.log('   ' + c.red('❌ Error consultando BD: ' + cErr.message));
        return;
    }
    console.log(`   Encontrados: ${c.cyan(candidates.length)} candidatos`);

    // ── 4. Filtro JS por hora real ──────────────────────────────────────────
    console.log('\n' + c.bold('4. Filtro por datetime real (date + time Madrid → UTC)'));
    const toSend = [];
    const skipped = [];

    for (const appt of candidates) {
        const apptUTC = apptToUTC(appt);
        if (!apptUTC) { skipped.push({ appt, reason: 'sin campo time' }); continue; }

        const inWindow = apptUTC >= startWindow && apptUTC <= endWindow;
        const dateStr  = new Date(appt.date).toISOString().split('T')[0];
        const offset   = getSpainUTCOffset(dateStr);
        const hoursAway = ((apptUTC - now) / 3600000).toFixed(1);

        if (inWindow) {
            toSend.push({ appt, apptUTC, hoursAway });
        } else {
            skipped.push({ appt, apptUTC, hoursAway, reason: `fuera de ventana (a ${hoursAway}h)` });
        }
    }

    if (toSend.length === 0) {
        console.log('   ' + c.yellow('⚠️  Ninguna cita cae en la ventana de 12h ahora mismo'));
        console.log(c.dim('   (Normal si no hay citas programadas exactamente en ese rango)'));
    }

    for (const { appt, apptUTC, hoursAway } of toSend) {
        const phone   = appt.patient?.phone || '⚠️ sin teléfono';
        const name    = appt.patient?.name  || '?';
        const message = renderMessage({
            ...appt,
            patient_name:   name,
            treatment_name: appt.treatment?.name,
        }, template.content);

        console.log('\n   ' + c.green(`✅ ENVIARÍA → ${name}`));
        console.log(`      Teléfono:  ${phone}`);
        console.log(`      Cita UTC:  ${apptUTC.toISOString()} (en ${hoursAway}h)`);
        console.log(`      Mensaje:`);
        console.log(c.cyan('      ┌─────────────────────────────────────'));
        message.split('\n').forEach(l => console.log(c.cyan('      │ ') + l));
        console.log(c.cyan('      └─────────────────────────────────────'));
    }

    if (skipped.length > 0) {
        console.log('\n' + c.bold('5. Candidatos descartados (fuera de ventana)'));
        for (const { appt, hoursAway, reason } of skipped) {
            const name = appt.patient?.name || appt.id;
            console.log(c.dim(`   ⏭  ${name} — ${appt.time || '??'} — ${reason}`));
        }
    }

    // ── Resumen ─────────────────────────────────────────────────────────────
    console.log('\n' + c.bold('══════════════════════════════════════════════════'));
    console.log(c.bold(`  RESULTADO: ${toSend.length} mensaje(s) se enviarían`));
    if (motorStatus !== 'true') {
        console.log(c.yellow(`  Motor pausado → para activar: WHATSAPP_ENABLED=true en Vercel`));
    }
    console.log(c.bold('══════════════════════════════════════════════════\n'));
}

main().catch(err => {
    console.error('\n❌ Error inesperado:', err.message);
    process.exit(1);
});
