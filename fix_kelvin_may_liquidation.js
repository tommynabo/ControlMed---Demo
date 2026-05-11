#!/usr/bin/env node
/**
 * Fix: crear liquidación faltante para el pago de Kelvin de mayo 2026.
 *
 * ANTES DE EJECUTAR: corre el diagnóstico y rellena las constantes de abajo:
 *   node diagnose_kelvin_may_payment.js
 *
 * Modo diagnóstico (por defecto): solo muestra lo que haría, sin escribir nada.
 * Modo aplicar: node fix_kelvin_may_liquidation.js --apply
 *
 * INSTRUCCIONES:
 *  1. Copia los IDs del output de diagnose_kelvin_may_payment.js
 *  2. Rellena las constantes PAYMENT_ID, APPOINTMENT_ID, DOCTOR_ID, AMOUNT, etc.
 *  3. Ejecuta: node fix_kelvin_may_liquidation.js           (dry-run)
 *  4. Si todo parece correcto: node fix_kelvin_may_liquidation.js --apply
 */

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// ══════════════════════════════════════════════════════════════════════════
// RELLENA ESTOS VALORES CON EL OUTPUT DE diagnose_kelvin_may_payment.js
// ══════════════════════════════════════════════════════════════════════════

const PAYMENT_ID     = 'REEMPLAZA_CON_PAYMENT_ID';      // id del pago de Kelvin
const APPOINTMENT_ID = 'REEMPLAZA_CON_APPOINTMENT_ID';  // appointmentId del pago
const DOCTOR_ID      = 'REEMPLAZA_CON_DOCTOR_ID';       // doctorId de la cita
const PATIENT_NAME   = 'Kelvin';                        // nombre del paciente (para la liquidación)
const AMOUNT         = 0;                               // importe del pago (grossAmount)
const TREATMENT_NAME = 'Tratamiento';                   // nombre del tratamiento
const PAYMENT_METHOD = 'card';                          // método de pago: card / cash / transfer
const PAYMENT_DATE   = '2026-05-05T10:00:00.000Z';      // fecha del pago (createdAt de la cita)
const COMMISSION_PCT = 30;                              // % comisión del doctor (ver Doctor.commissionPercentage)

// ══════════════════════════════════════════════════════════════════════════

const APPLY = process.argv.includes('--apply');

function validate() {
    const missing = [];
    if (PAYMENT_ID     === 'REEMPLAZA_CON_PAYMENT_ID')     missing.push('PAYMENT_ID');
    if (APPOINTMENT_ID === 'REEMPLAZA_CON_APPOINTMENT_ID') missing.push('APPOINTMENT_ID');
    if (DOCTOR_ID      === 'REEMPLAZA_CON_DOCTOR_ID')      missing.push('DOCTOR_ID');
    if (AMOUNT         === 0)                              missing.push('AMOUNT (es 0, ¿correcto?)');
    return missing;
}

async function main() {
    console.log('══════════════════════════════════════════════════');
    console.log(`  FIX LIQUIDACIÓN KELVIN MAYO 2026 — ${APPLY ? '🔴 MODO APLICAR' : '🟡 DRY-RUN'}`);
    console.log('══════════════════════════════════════════════════\n');

    const missing = validate();
    if (missing.length) {
        console.error('❌ Faltan valores en las constantes:');
        missing.forEach(m => console.error(`   - ${m}`));
        console.error('\nEdita las constantes al principio del script y vuelve a ejecutar.');
        process.exit(1);
    }

    // Verificar que no exista ya una liquidación para esta cita + doctor
    const { data: existing } = await supabase
        .from('Liquidation')
        .select('id, grossAmount, finalAmount, treatmentName, status')
        .eq('appointmentId', APPOINTMENT_ID)
        .eq('doctorId', DOCTOR_ID);

    if (existing?.length) {
        console.log('⚠️  Ya existe una liquidación para esta cita + doctor:');
        existing.forEach(l =>
            console.log(`   ID: ${l.id} | Bruto: ${l.grossAmount}€ | Neto: ${l.finalAmount}€ | ${l.treatmentName} | ${l.status}`)
        );
        console.log('\nNo se va a crear nada para evitar duplicados. Si la existente es incorrecta,');
        console.log('bórrala primero desde el SQL de Supabase y vuelve a ejecutar.');
        return;
    }

    const grossAmount = AMOUNT;
    const finalAmount = grossAmount * (COMMISSION_PCT / 100);
    const liquidationId = crypto.randomUUID();

    console.log('📋 Liquidación a crear:');
    console.log(`   ID:              ${liquidationId}`);
    console.log(`   Doctor ID:       ${DOCTOR_ID}`);
    console.log(`   Appointment ID:  ${APPOINTMENT_ID}`);
    console.log(`   Payment ID:      ${PAYMENT_ID}`);
    console.log(`   Tratamiento:     ${TREATMENT_NAME}`);
    console.log(`   Paciente:        ${PATIENT_NAME}`);
    console.log(`   Bruto:           ${grossAmount}€`);
    console.log(`   Comisión:        ${COMMISSION_PCT}%  →  ${finalAmount.toFixed(2)}€ neto`);
    console.log(`   Método:          ${PAYMENT_METHOD}`);
    console.log(`   Fecha:           ${PAYMENT_DATE}`);
    console.log(`   Estado:          PENDING\n`);

    if (!APPLY) {
        console.log('🟡 DRY-RUN: no se ha escrito nada. Añade --apply para guardar.');
        return;
    }

    const { data: liq, error } = await supabase
        .from('Liquidation')
        .insert({
            id: liquidationId,
            doctorId: DOCTOR_ID,
            appointmentId: APPOINTMENT_ID,
            paymentId: PAYMENT_ID,
            itemIndex: null,
            grossAmount,
            baseAmount: grossAmount,
            labCost: 0,
            commissionRate: COMMISSION_PCT,
            finalAmount,
            referralCommission: 0,
            referralEntityName: null,
            treatmentName: TREATMENT_NAME,
            patientName: PATIENT_NAME,
            paymentMethod: PAYMENT_METHOD,
            status: 'PENDING',
            createdAt: PAYMENT_DATE
        })
        .select()
        .single();

    if (error) {
        console.error('❌ Error al crear la liquidación:', error.message);
        process.exit(1);
    }

    console.log(`✅ Liquidación creada: ${liq.id}`);
    console.log('\nVerifica en la app: Liquidaciones → selecciona el doctor → mayo 2026 → debe aparecer Kelvin.');
}

main().catch(err => {
    console.error('Error fatal:', err.message);
    process.exit(1);
});
