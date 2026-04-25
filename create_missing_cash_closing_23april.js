#!/usr/bin/env node
/**
 * Crea el cierre de caja del 23/04/2026 que nunca se registró.
 * El retiro de 600€ quedó sin cerrar, por eso hoy aparecen 630€ de caja inicial.
 *
 * USO:
 *   node create_missing_cash_closing_23april.js          → dry-run
 *   node create_missing_cash_closing_23april.js --apply  → aplica
 */

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const APPLY = process.argv.includes('--apply');
const DATE_23 = '2026-04-23';

async function main() {
    console.log('══════════════════════════════════════════════════');
    console.log('  CREAR CIERRE DE CAJA DEL 23/04/2026');
    console.log('══════════════════════════════════════════════════');
    console.log(APPLY ? '⚠️  MODO: APLICAR CAMBIOS' : '🔍 MODO: DIAGNÓSTICO\n');

    // 1. Verificar que no exista ya un cierre del 23/04
    const { data: existing } = await supabase
        .from('cash_register_closings')
        .select('id, date, physicalCash')
        .eq('date', DATE_23)
        .maybeSingle();

    if (existing) {
        console.log(`⚠️  Ya existe un cierre para el ${DATE_23}:`);
        console.log(`   physicalCash: ${existing.physicalCash}€`);
        console.log('\nNo se ha creado nada.');
        return;
    }
    console.log(`✅ No existe cierre del ${DATE_23} — podemos crearlo.\n`);

    // 2. Calcular datos del 23/04

    // Facturas en efectivo del 23/04
    const { data: invoices23 } = await supabase
        .from('Invoice')
        .select('id, amount, paymentMethod, concept')
        .gte('date', `${DATE_23}T00:00:00`)
        .lte('date', `${DATE_23}T23:59:59`)
        .not('status', 'in', '("rectified","pending","refunded")');

    const cashInvoices = (invoices23 || []).filter(i => i.paymentMethod === 'cash');
    const cardInvoices = (invoices23 || []).filter(i => i.paymentMethod === 'card');
    const transferInvoices = (invoices23 || []).filter(i => i.paymentMethod === 'transfer');

    const cashIncome    = cashInvoices.reduce((s, i) => s + Number(i.amount), 0);
    const cardIncome    = cardInvoices.reduce((s, i) => s + Number(i.amount), 0);
    const transferIncome = transferInvoices.reduce((s, i) => s + Number(i.amount), 0);
    const totalIncome   = cashIncome + cardIncome + transferIncome;

    console.log(`📄 Facturas del ${DATE_23}:`);
    (invoices23 || []).forEach(i => console.log(`   ${i.concept} — ${i.amount}€ (${i.paymentMethod})`));
    if (!invoices23 || invoices23.length === 0) console.log('   (sin facturas)');

    // Gastos del 23/04
    const { data: expenses23 } = await supabase
        .from('expenses')
        .select('id, description, amount, paymentMethod')
        .eq('date', DATE_23);

    const cashExpensesList = (expenses23 || []).filter(e => e.paymentMethod === 'cash');
    const cashExpenses = cashExpensesList.reduce((s, e) => s + Number(e.amount), 0);
    const totalExpense = (expenses23 || []).reduce((s, e) => s + Number(e.amount), 0);

    console.log(`\n💸 Gastos del ${DATE_23}:`);
    (expenses23 || []).forEach(e => console.log(`   ${e.description} — ${e.amount}€ (${e.paymentMethod})`));
    if (!expenses23 || expenses23.length === 0) console.log('   (sin gastos)');

    // Caja inicial: physicalCash del cierre del 22/04
    const { data: prev } = await supabase
        .from('cash_register_closings')
        .select('physicalCash, date')
        .lt('date', DATE_23)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle();

    const openingCash   = prev?.physicalCash ?? 0;
    const netCash       = cashIncome - cashExpenses;
    const expectedCash  = openingCash + netCash;
    // physicalCash = lo que quedaba físicamente en caja tras el retiro
    const physicalCash  = 30.74; // confirmado por el usuario: ~30€ después del retiro de 600€

    console.log(`\n📊 RESUMEN DEL CIERRE A CREAR:`);
    console.log(`   Fecha:            ${DATE_23}`);
    console.log(`   openingCash:      ${openingCash}€   (physicalCash del ${prev?.date || 'día anterior'})`);
    console.log(`   cashIncome:       ${cashIncome}€`);
    console.log(`   cardIncome:       ${cardIncome}€`);
    console.log(`   transferIncome:   ${transferIncome}€`);
    console.log(`   totalIncome:      ${totalIncome}€`);
    console.log(`   cashExpenses:     ${cashExpenses}€   (incluye retiro 600€)`);
    console.log(`   totalExpense:     ${totalExpense}€`);
    console.log(`   netCash:          ${netCash}€`);
    console.log(`   expectedCash:     ${expectedCash}€`);
    console.log(`   physicalCash:     ${physicalCash}€   ← lo que había físicamente (confirmado)`);
    console.log(`   cashDiff:         ${(physicalCash - expectedCash).toFixed(2)}€`);

    console.log(`\n   ✅ Efecto: mañana (24/04 y sucesivos) usarán ${physicalCash}€ como caja inicial`);
    console.log(`             En vez de 630.74€ (incorrecto)`);

    if (!APPLY) {
        console.log('\n════════════════════════════════════════════════');
        console.log('  🔍 DRY RUN — no se ha modificado nada');
        console.log('  Para aplicar: node create_missing_cash_closing_23april.js --apply');
        console.log('════════════════════════════════════════════════');
        return;
    }

    // 3. Crear el cierre
    console.log('\n🔧 Creando cierre de caja del 23/04...');

    const { error } = await supabase
        .from('cash_register_closings')
        .insert([{
            id: crypto.randomUUID(),
            date: DATE_23,
            closedAt: new Date(`${DATE_23}T23:59:00.000Z`).toISOString(),
            closedBy: 'sistema (corrección manual)',
            totalIncome,
            totalExpense,
            balance: totalIncome - totalExpense,
            cashIncome,
            cardIncome,
            transferIncome,
            cashExpenses,
            netCash,
            physicalCash,
            cashDiff: parseFloat((physicalCash - expectedCash).toFixed(2)),
            invoiceCount: (invoices23 || []).length,
            completedAppointments: 0,
            openingCash
        }]);

    if (error) { console.error('❌ Error:', error.message); process.exit(1); }

    console.log('   ✅ Cierre creado correctamente');

    // 4. Verificar qué ve ahora la caja de hoy
    console.log('\n🔍 Verificando la cadena de openingCash ahora...');
    const { data: all } = await supabase
        .from('cash_register_closings')
        .select('date, physicalCash, openingCash')
        .order('date', { ascending: false })
        .limit(5);

    console.log('\n   Fecha       | physicalCash | openingCash');
    console.log('   ────────────|─────────────|────────────');
    (all || []).forEach(c => {
        console.log(`   ${c.date}  | ${String(c.physicalCash ?? '?').padStart(11)}€ | ${c.openingCash ?? '?'}€`);
    });

    console.log('\n══════════════════════════════════════════════════');
    console.log('  ✅ COMPLETADO');
    console.log('══════════════════════════════════════════════════');
    console.log(`\n  Cierre del 23/04 creado con physicalCash = ${physicalCash}€`);
    console.log(`  → La caja de hoy (25/04) debe mostrar ~30€ como caja inicial.`);
    console.log(`\n  ⚠️  NOTA: También hay una RETIRADA DE 250€ del 24/04 sin cierre.`);
    console.log(`      Si necesitas que hoy muestre 30€ considerando esa retirada también,`);
    console.log(`      ejecuta: node create_missing_cash_closing_24april.js --apply`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
