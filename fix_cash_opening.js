#!/usr/bin/env node
/**
 * Diagnóstico y corrección del physicalCash en cash_register_closings
 * para resolver el problema de caja inicial incorrecta (630€ → 30€)
 *
 * USO:
 *   node fix_cash_opening.js              → sólo diagnóstico
 *   node fix_cash_opening.js --apply      → aplica corrección (physicalCash = 30)
 *   node fix_cash_opening.js --apply --date=2026-04-24  → fecha específica
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const APPLY = process.argv.includes('--apply');
const dateArg = process.argv.find(a => a.startsWith('--date='));
const TARGET_DATE = dateArg ? dateArg.split('=')[1] : null;

async function main() {
    console.log('══════════════════════════════════════════════════');
    console.log('  DIAGNÓSTICO CAJA INICIAL (RETIRO KEVIN 600€)');
    console.log('══════════════════════════════════════════════════');
    console.log(APPLY ? '⚠️  MODO: APLICAR CAMBIOS' : '🔍 MODO: DIAGNÓSTICO\n');

    // 1. Ver últimos cierres de caja
    console.log('\n📊 Últimos cierres de caja:');
    const { data: closings, error } = await supabase
        .from('cash_register_closings')
        .select('id, date, "physicalCash", "openingCash", "netCash", "cashIncome", "cashExpenses", "cashDiff"')
        .order('date', { ascending: false })
        .limit(5);

    if (error) { console.error('❌', error.message); process.exit(1); }

    closings.forEach(c => {
        const opening = c.openingCash ?? 0;
        const net = c.netCash ?? 0;
        const expected = opening + net;
        const physical = c.physicalCash ?? 0;
        console.log(`\n   📅 ${c.date}`);
        console.log(`      openingCash:   ${opening}€  (caja inicial del día)`);
        console.log(`      cashIncome:    ${c.cashIncome ?? 0}€`);
        console.log(`      cashExpenses:  ${c.cashExpenses ?? 0}€  (gastos efectivo, incluye retiros)`);
        console.log(`      netCash:       ${net}€`);
        console.log(`      expectedCash:  ${expected}€  (lo que debería haber en caja)`);
        console.log(`      physicalCash:  ${physical}€  ← ESTE VALOR PASA COMO "openingCash" AL DÍA SIGUIENTE`);
        if (Math.abs(physical - expected) > 0.01) {
            console.log(`      ⚠️  DISCREPANCIA: physicalCash(${physical}) ≠ expected(${expected})`);
        }
    });

    // 2. Ver gastos en efectivo de los últimos días
    console.log('\n\n💸 Gastos en efectivo (últimos 5 días):');
    const { data: expenses } = await supabase
        .from('expenses')
        .select('id, description, amount, "paymentMethod", date')
        .eq('paymentMethod', 'cash')
        .gte('date', '2026-04-20')
        .order('date', { ascending: false });

    if (expenses && expenses.length > 0) {
        expenses.forEach(e => {
            const isRetiro = (e.description || '').toUpperCase().includes('RETIRO');
            console.log(`   ${e.date} | ${e.description} | ${e.amount}€ ${isRetiro ? '⬅️  RETIRO' : ''}`);
        });
    } else {
        console.log('   (sin gastos en efectivo)');
    }

    // 3. Identificar el cierre a corregir
    // El retiro fue el 23/04 → el physicalCash del cierre del 23 (o 24 si no cerró el 23)
    // debe reflejar 30€
    const wrongClosing = closings.find(c => {
        const physical = c.physicalCash ?? 0;
        return physical > 100; // El closing que tiene más de 100€ como physical (el incorrecto)
    });

    if (!wrongClosing) {
        console.log('\n✅ No se detecta ningún physicalCash claramente incorrecto.');
        console.log('   Revisa los valores arriba manualmente.');
        return;
    }

    const correctPhysical = 30;
    console.log(`\n\n🎯 CIERRE A CORREGIR: ${wrongClosing.date}`);
    console.log(`   physicalCash actual:   ${wrongClosing.physicalCash}€  ❌`);
    console.log(`   physicalCash correcto: ${correctPhysical}€  ✅`);

    if (!APPLY) {
        console.log('\n════════════════════════════════════════════════');
        console.log('  🔍 DRY RUN — no se ha modificado nada');
        console.log(`  Para aplicar: node fix_cash_opening.js --apply`);
        console.log(`  O especificar fecha: node fix_cash_opening.js --apply --date=${wrongClosing.date}`);
        console.log('════════════════════════════════════════════════');
        return;
    }

    const dateToFix = TARGET_DATE || wrongClosing.date;
    console.log(`\n🔧 Corrigiendo physicalCash del ${dateToFix} → ${correctPhysical}€...`);

    const { error: updateErr } = await supabase
        .from('cash_register_closings')
        .update({ physicalCash: correctPhysical })
        .eq('date', dateToFix);

    if (updateErr) { console.error('❌ Error:', updateErr.message); process.exit(1); }

    console.log('   ✅ physicalCash actualizado a 30€');
    console.log('\n══════════════════════════════════════════════════');
    console.log('  ✅ CORRECCIÓN COMPLETADA');
    console.log('══════════════════════════════════════════════════');
    console.log(`\n  → Recarga la caja de hoy (25/04). La caja inicial debe mostrar 30€.`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
