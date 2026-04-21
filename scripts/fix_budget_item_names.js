/**
 * fix_budget_item_names.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Repairs BudgetLineItem rows that have name = 'Servicio' (set incorrectly by
 * the CSV migration which read SERVICIO/PRODUCTO instead of CONCEPTO).
 *
 * Strategy:
 *   1. Read BaseDatos/5ad6a3ce9affc0b9510af346244ce5df_37752_1774408541.csv
 *   2. Build a lookup: budget number → [ { concepto, precio, qty, pieza } ]
 *   3. Fetch every Budget with title matching "Presupuesto N. <num>"
 *   4. For each budget, match its items where name = 'Servicio' to a CSV row
 *      by comparing price + quantity (+ tooth when available)
 *   5. UPDATE those items with the real CONCEPTO name
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/fix_budget_item_names.js
 *
 * Dry-run (no writes):
 *   DRY_RUN=1 SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/fix_budget_item_names.js
 */

'use strict';

const { createClient } = require('@supabase/supabase-js');
const { parse }        = require('csv-parse/sync');
const fs               = require('fs');
const path             = require('path');

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const SUPABASE_URL  = process.env.SUPABASE_URL || 'https://gnnacijqglcqonholpwt.supabase.co';
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const DRY_RUN       = process.env.DRY_RUN === '1';
const CSV_FILE      = path.join(__dirname, '..', 'BaseDatos', '5ad6a3ce9affc0b9510af346244ce5df_37752_1774408541.csv');

if (!SERVICE_KEY) {
    console.error('ERROR: Set SUPABASE_SERVICE_ROLE_KEY in .env or environment');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

function clean(v) {
    if (v == null) return '';
    return String(v).trim().replace(/^"|"$/g, '');
}

async function main() {
    if (DRY_RUN) console.log('[DRY RUN] No changes will be written to the database.\n');

    // ── 1. Read CSV ───────────────────────────────────────────────────────────
    console.log(`Reading CSV: ${CSV_FILE}`);
    if (!fs.existsSync(CSV_FILE)) {
        console.error('CSV file not found. Check BaseDatos folder.');
        process.exit(1);
    }
    const raw  = fs.readFileSync(CSV_FILE, 'utf8');
    const rows = parse(raw, { delimiter: ';', columns: true, skip_empty_lines: true, relax_quotes: true, trim: true });
    console.log(`CSV rows: ${rows.length}`);

    // ── 2. Build lookup: budgetNum → lines[] ─────────────────────────────────
    // Map: budgetNum (string) → array of { concepto, precio, qty, pieza }
    const csvGroups = new Map();
    for (const r of rows) {
        const num      = clean(r['NÚMERO']);
        const concepto = clean(r['CONCEPTO']);
        if (!num || !concepto) continue;
        const basePrice = parseFloat(clean(r['TOTAL CONCEPTO'])) || 0;
        const qty       = parseInt(clean(r['CANTIDAD'])) || 1;
        const pieza     = clean(r['PIEZA']);
        const descuento = parseFloat(clean(r['DESCUENTO'])) || 0;
        const unitPrice = qty > 0 ? basePrice / qty : basePrice;
        const finalPrice = Math.max(0, unitPrice - (unitPrice * descuento / 100));
        // Round to 2dp to avoid floating-point mismatches
        const price = Math.round(finalPrice * 100) / 100;

        if (!csvGroups.has(num)) csvGroups.set(num, []);
        csvGroups.get(num).push({ concepto, price, qty, pieza });
    }
    console.log(`Unique budget numbers in CSV: ${csvGroups.size}`);

    // ── 3. Fetch budgets that were imported from CSV ──────────────────────────
    // Titles follow the pattern "Presupuesto N. <num>"
    const { data: budgets, error: budgetsErr } = await supabase
        .from('Budget')
        .select('id, title')
        .like('title', 'Presupuesto N. %');

    if (budgetsErr) { console.error('Error fetching budgets:', budgetsErr.message); process.exit(1); }
    console.log(`Budgets matching "Presupuesto N. *": ${budgets.length}`);

    // ── 4. For each budget, fix items with name = 'Servicio' ─────────────────
    let totalFixed  = 0;
    let totalFailed = 0;
    let totalSkipped = 0;

    for (const budget of budgets) {
        // Extract number from title e.g. "Presupuesto N. 246" → "246"
        const match = budget.title.match(/Presupuesto N\.\s*(\d+)/);
        if (!match) continue;
        const budgetNum = match[1];

        const csvLines = csvGroups.get(budgetNum);
        if (!csvLines || csvLines.length === 0) { totalSkipped++; continue; }

        // Fetch the items of this budget that need fixing
        const { data: items, error: itemsErr } = await supabase
            .from('BudgetLineItem')
            .select('id, name, price, quantity, tooth')
            .eq('budgetId', budget.id)
            .eq('name', 'Servicio');

        if (itemsErr) {
            console.warn(`  [${budget.title}] Error fetching items: ${itemsErr.message}`);
            continue;
        }
        if (!items || items.length === 0) { totalSkipped++; continue; }

        // For each item named 'Servicio', find a matching CSV line
        // Match on price (rounded) + quantity, and tooth when available.
        // We consume CSV lines one-by-one to handle duplicates correctly.
        const remaining = [...csvLines];

        for (const item of items) {
            const itemPrice = Math.round(Number(item.price) * 100) / 100;
            const itemQty   = Number(item.quantity) || 1;
            const itemTooth = item.tooth || '';

            // Try to find a best match: prefer tooth match, fall back to price+qty only
            let matchIdx = -1;

            // First pass: price + qty + tooth
            if (itemTooth) {
                matchIdx = remaining.findIndex(l =>
                    Math.round(l.price * 100) / 100 === itemPrice &&
                    l.qty === itemQty &&
                    l.pieza === itemTooth
                );
            }
            // Second pass: price + qty (ignore tooth)
            if (matchIdx === -1) {
                matchIdx = remaining.findIndex(l =>
                    Math.round(l.price * 100) / 100 === itemPrice &&
                    l.qty === itemQty
                );
            }
            // Third pass: price only (fallback for rounding edge cases ±0.01)
            if (matchIdx === -1) {
                matchIdx = remaining.findIndex(l =>
                    Math.abs(Math.round(l.price * 100) / 100 - itemPrice) <= 0.01
                );
            }

            if (matchIdx === -1) {
                console.warn(`  [${budget.title}] No CSV match for item id=${item.id} price=${item.price} qty=${itemQty} tooth="${itemTooth}"`);
                totalFailed++;
                continue;
            }

            const csvLine = remaining.splice(matchIdx, 1)[0];

            if (DRY_RUN) {
                console.log(`  [DRY] Would update item ${item.id}: "Servicio" → "${csvLine.concepto}"`);
                totalFixed++;
                continue;
            }

            const { error: updateErr } = await supabase
                .from('BudgetLineItem')
                .update({ name: csvLine.concepto })
                .eq('id', item.id);

            if (updateErr) {
                console.warn(`  [${budget.title}] Failed to update item ${item.id}: ${updateErr.message}`);
                totalFailed++;
            } else {
                console.log(`  [${budget.title}] Fixed item ${item.id}: "Servicio" → "${csvLine.concepto}"`);
                totalFixed++;
            }
        }
    }

    // ── 5. Summary ───────────────────────────────────────────────────────────
    console.log('\n═══════════════════════════════════════');
    console.log(`Items fixed    : ${totalFixed}`);
    console.log(`Items failed   : ${totalFailed}`);
    console.log(`Budgets skipped: ${totalSkipped} (no CSV data or already correct)`);
    if (DRY_RUN) console.log('\n[DRY RUN] Re-run without DRY_RUN=1 to apply changes.');
    console.log('Done.');
}

main().catch(err => { console.error('Fatal error:', err); process.exit(1); });
