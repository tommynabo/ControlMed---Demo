#!/usr/bin/env node
/**
 * Diagnóstico + cierre retroactivo del 18/05/2026
 * 
 * USO:
 *   node fix_missing_closing_18may.js           → dry-run (solo diagnóstico)
 *   node fix_missing_closing_18may.js --apply   → aplica el cierre
 */

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const APPLY = process.argv.includes('--apply');
const DATE  = '2026-05-18';
const TODAY = '2026-05-19';

async function main() {
    console.log('══════════════════════════════════════════════════════════');
    console.log('  CIERRE RETROACTIVO 18/05/2026');
    console.log('══════════════════════════════════════════════════════════');
    console.log(APPLY ? '⚠️  MODO: APLICAR CAMBIOS\n' : '🔍 MODO: DIAGNÓSTICO (dry-run)\n');

    // ── 1. Últimos cierres ────────────────────────────────────────────────────
    console.log('📋 Últimos cierres de caja:');
    const { data: closings, error: closErr } = await supabase
        .from('cash_register_closings')
        .select('date, "openingCash", "physicalCash", "cashIncome", "cardIncome", "transferIncome", "totalIncome", "cashExpenses"')
        .order('date', { ascending: false })
        .limit(7);

    if (closErr) { console.error('❌ Error leyendo cierres:', closErr.message); process.exit(1); }

    if (!closings || closings.length === 0) {
        console.log('   (sin cierres registrados aún)');
    } else {
        console.log('   Fecha       | openingCash | physicalCash | cashIncome | cardIncome | transferIncome | totalIncome');
        console.log('   ────────────|─────────────|──────────────|────────────|────────────|────────────────|────────────');
        closings.forEach(c => {
            console.log(`   ${c.date}  | ${String((c.openingCash ?? 0).toFixed(2)).padStart(11)}€ | ${String((c.physicalCash ?? 0).toFixed(2)).padStart(12)}€ | ${String((c.cashIncome ?? 0).toFixed(2)).padStart(10)}€ | ${String((c.cardIncome ?? 0).toFixed(2)).padStart(10)}€ | ${String((c.transferIncome ?? 0).toFixed(2)).padStart(14)}€ | ${String((c.totalIncome ?? 0).toFixed(2)).padStart(10)}€`);
        });
    }

    // ── 2. ¿Ya existe cierre del 18/05? ──────────────────────────────────────
    console.log(`\n🔍 Comprobando si ya existe cierre del ${DATE}...`);
    const { data: existing } = await supabase
        .from('cash_register_closings')
        .select('id, date, "physicalCash"')
        .eq('date', DATE)
        .maybeSingle();

    if (existing) {
        console.log(`\n⚠️  Ya existe un cierre para el ${DATE}:`);
        console.log(`   physicalCash: ${existing.physicalCash}€`);
        console.log('\n✅ No se necesita crear nada para ayer.');

        // Verificar arrastre de hoy de todas formas
        await verificarArrastreHoy(closings);
        return;
    }
    console.log(`   ✅ No existe cierre del ${DATE} — se puede crear.\n`);

    // ── 3. openingCash para el 18/05 = physicalCash del último cierre anterior ─
    const { data: prevClosing } = await supabase
        .from('cash_register_closings')
        .select('date, "physicalCash"')
        .lt('date', DATE)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle();

    const openingCash = prevClosing?.physicalCash ?? 0;
    console.log(`💰 Arrastre (openingCash) para el ${DATE}: ${openingCash}€`);
    console.log(`   (tomado del cierre del ${prevClosing?.date || 'ninguno anterior'})\n`);

    // ── 4. Facturas del 18/05 ─────────────────────────────────────────────────
    const { data: invoices18 } = await supabase
        .from('Invoice')
        .select('id, amount, paymentMethod, paymentBreakdown, concept, status')
        .gte('date', `${DATE}T00:00:00`)
        .lte('date', `${DATE}T23:59:59`)
        .not('status', 'in', '("rectified","pending","refunded")');

    console.log(`📄 Facturas del ${DATE} (${(invoices18 || []).length} facturas):`);
    (invoices18 || []).forEach(i => {
        console.log(`   ${i.concept || '(sin concepto)'} — ${i.amount}€  [${i.paymentMethod}]  [${i.status}]`);
    });
    if (!invoices18 || invoices18.length === 0) console.log('   (sin facturas)');

    // Calcular totales por método (soportando 'mixed' con paymentBreakdown)
    let cashIncome = 0, cardIncome = 0, transferIncome = 0;
    for (const inv of (invoices18 || [])) {
        const method = inv.paymentMethod;
        if (method === 'mixed' && inv.paymentBreakdown) {
            const breakdown = typeof inv.paymentBreakdown === 'string'
                ? JSON.parse(inv.paymentBreakdown)
                : inv.paymentBreakdown;
            for (const item of (breakdown || [])) {
                if (item.method === 'cash')     cashIncome     += Number(item.amount || 0);
                if (item.method === 'card')     cardIncome     += Number(item.amount || 0);
                if (item.method === 'transfer') transferIncome += Number(item.amount || 0);
            }
        } else if (method === 'cash')     cashIncome     += Number(inv.amount || 0);
        else if (method === 'card')       cardIncome     += Number(inv.amount || 0);
        else if (method === 'transfer')   transferIncome += Number(inv.amount || 0);
    }
    const totalIncome = (invoices18 || []).reduce((s, i) => s + Number(i.amount || 0), 0);
    const invoiceCount = (invoices18 || []).length;

    console.log(`\n   → Efectivo:    ${cashIncome.toFixed(2)}€`);
    console.log(`   → Tarjeta:     ${cardIncome.toFixed(2)}€`);
    console.log(`   → Transferencia: ${transferIncome.toFixed(2)}€`);
    console.log(`   → TOTAL:       ${totalIncome.toFixed(2)}€`);

    // ── 5. Gastos del 18/05 ───────────────────────────────────────────────────
    const { data: expenses18 } = await supabase
        .from('expenses')
        .select('id, description, amount, paymentMethod')
        .eq('date', DATE);

    console.log(`\n💸 Gastos del ${DATE} (${(expenses18 || []).length} gastos):`);
    (expenses18 || []).forEach(e => {
        console.log(`   ${e.description || '(sin descripción)'} — ${e.amount}€  [${e.paymentMethod || 'cash'}]`);
    });
    if (!expenses18 || expenses18.length === 0) console.log('   (sin gastos)');

    const cashExpenses  = (expenses18 || [])
        .filter(e => !e.paymentMethod || e.paymentMethod === 'cash')
        .reduce((s, e) => s + Number(e.amount || 0), 0);
    const totalExpense  = (expenses18 || []).reduce((s, e) => s + Number(e.amount || 0), 0);

    console.log(`\n   → Gastos efectivo: ${cashExpenses.toFixed(2)}€`);
    console.log(`   → Gastos totales:  ${totalExpense.toFixed(2)}€`);

    // ── 6. Cálculo del cierre ─────────────────────────────────────────────────
    const netCash       = round2(cashIncome - cashExpenses);
    const balance       = round2(totalIncome - totalExpense);
    const physicalCash  = round2(openingCash + netCash);  // estimado sin arqueo

    console.log('\n');
    console.log('══════════════════════════════════════════════════════════');
    console.log('  📊 RESUMEN DEL CIERRE A CREAR');
    console.log('══════════════════════════════════════════════════════════');
    console.log(`  Fecha:               ${DATE}`);
    console.log(`  openingCash:         ${openingCash.toFixed(2)}€  (arrastre del ${prevClosing?.date || 'ninguno'})`);
    console.log(`  cashIncome:          ${cashIncome.toFixed(2)}€`);
    console.log(`  cardIncome:          ${cardIncome.toFixed(2)}€`);
    console.log(`  transferIncome:      ${transferIncome.toFixed(2)}€`);
    console.log(`  totalIncome:         ${totalIncome.toFixed(2)}€`);
    console.log(`  cashExpenses:        ${cashExpenses.toFixed(2)}€`);
    console.log(`  totalExpense:        ${totalExpense.toFixed(2)}€`);
    console.log(`  netCash:             ${netCash.toFixed(2)}€`);
    console.log(`  balance:             ${balance.toFixed(2)}€`);
    console.log(`  physicalCash:        ${physicalCash.toFixed(2)}€  ← arrastre para el ${TODAY}`);
    console.log(`  cashDiff:            0.00€  (sin arqueo físico en retroactivo)`);
    console.log(`  invoiceCount:        ${invoiceCount}`);

    if (!APPLY) {
        console.log('\n══════════════════════════════════════════════════════════');
        console.log('  🔍 DRY RUN — no se ha modificado nada');
        console.log('  Para aplicar: node fix_missing_closing_18may.js --apply');
        console.log('══════════════════════════════════════════════════════════\n');
        return;
    }

    // ── 7. Insertar el cierre ─────────────────────────────────────────────────
    console.log('\n🔧 Insertando cierre del 18/05/2026...');
    const { error: insertErr } = await supabase
        .from('cash_register_closings')
        .insert([{
            id:                   crypto.randomUUID(),
            date:                 DATE,
            closedAt:             new Date(`${DATE}T23:59:00.000Z`).toISOString(),
            closedBy:             'cierre manual retroactivo (admin)',
            totalIncome:          round2(totalIncome),
            totalExpense:         round2(totalExpense),
            balance:              balance,
            cashIncome:           round2(cashIncome),
            cardIncome:           round2(cardIncome),
            transferIncome:       round2(transferIncome),
            cashExpenses:         round2(cashExpenses),
            netCash:              netCash,
            physicalCash:         physicalCash,
            cashDiff:             0,
            invoiceCount:         invoiceCount,
            completedAppointments: 0,
            openingCash:          round2(openingCash),
        }]);

    if (insertErr) {
        console.error('❌ Error al insertar el cierre:', insertErr.message);
        process.exit(1);
    }
    console.log('   ✅ Cierre del 18/05/2026 creado correctamente');

    // ── 8. Verificar cadena de arrastres ──────────────────────────────────────
    await verificarArrastreHoy(null);
}

async function verificarArrastreHoy(existingClosings) {
    console.log('\n\n🔍 Verificando cadena de arrastres (últimos 5 cierres):');
    const { data: all } = await supabase
        .from('cash_register_closings')
        .select('date, "physicalCash", "openingCash", "totalIncome"')
        .order('date', { ascending: false })
        .limit(5);

    console.log('\n   Fecha       | openingCash | physicalCash | totalIncome');
    console.log('   ────────────|─────────────|──────────────|─────────────');
    (all || []).forEach(c => {
        console.log(`   ${c.date}  | ${String((c.openingCash ?? 0).toFixed(2)).padStart(11)}€ | ${String((c.physicalCash ?? 0).toFixed(2)).padStart(12)}€ | ${String((c.totalIncome ?? 0).toFixed(2)).padStart(11)}€`);
    });

    // Arrastre que verá hoy (19/05)
    const { data: arrastre } = await supabase
        .from('cash_register_closings')
        .select('date, "physicalCash"')
        .lt('date', '2026-05-19')
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle();

    console.log(`\n✅ Arrastre que verá la caja del ${TODAY}: ${arrastre?.physicalCash ?? 0}€`);
    console.log(`   (tomado del cierre del ${arrastre?.date || 'ninguno'})`);

    // Verificar si hoy ya tiene cierre
    const { data: todayClosing } = await supabase
        .from('cash_register_closings')
        .select('id, date, "physicalCash", "openingCash"')
        .eq('date', '2026-05-19')
        .maybeSingle();

    if (todayClosing) {
        console.log(`\n⚠️  El día de HOY (${TODAY}) YA tiene cierre registrado:`);
        console.log(`   openingCash:  ${todayClosing.openingCash}€`);
        console.log(`   physicalCash: ${todayClosing.physicalCash}€`);
        console.log('   → Si el openingCash no coincide con el physicalCash del 18/05, actualiza manualmente.');
    } else {
        console.log(`\n   El día de hoy (${TODAY}) aún NO está cerrado — cargará el arrastre correcto automáticamente al abrirse.`);
    }
}

function round2(n) {
    return Math.round(n * 100) / 100;
}

main().catch(e => {
    console.error('❌ Error inesperado:', e.message);
    process.exit(1);
});
