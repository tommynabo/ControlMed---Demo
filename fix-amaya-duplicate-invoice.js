#!/usr/bin/env node
/**
 * Delete duplicate Amaya invoice
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
    console.log('🗑️  Eliminando factura duplicada de Amaya 175€...\n');

    const invoiceId = '0dd59d54-4e7f-41b0-8103-0d00733e1dcd';

    console.log(`Factura a eliminar: ${invoiceId}`);
    console.log('Importe: 175€');
    console.log('Fecha: 20/4/2026, 13:29:18');
    console.log('Concepto: Blanqueamiento Domiciliario - Diente 11 (Pago Parcial)\n');

    // First delete invoice items
    console.log('1️⃣  Eliminando items de factura asociados...');
    const { error: itemError } = await supabase
        .from('InvoiceItem')
        .delete()
        .eq('invoiceId', invoiceId);

    if (itemError && itemError.code !== 'PGRST116') {
        console.error('❌ Error al eliminar items:', itemError.message);
        process.exit(1);
    }
    console.log('   ✅ Items eliminados');

    // Then delete invoice
    console.log('2️⃣  Eliminando factura...');
    const { error: invoiceError } = await supabase
        .from('Invoice')
        .delete()
        .eq('id', invoiceId);

    if (invoiceError) {
        console.error('❌ Error al eliminar factura:', invoiceError.message);
        process.exit(1);
    }
    console.log('   ✅ Factura eliminada');

    console.log('\n✅ Factura duplicada eliminada correctamente!');
    console.log('\n📊 Los totales de caja deben cuadrar ahora.');
}

main().catch(e => {
    console.error('❌ Error:', e.message);
    process.exit(1);
});
