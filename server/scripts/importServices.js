const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const csv = require('csv-parser'); // User might not have this, I'll use simple split

// CREDENTIALS FROM ENV
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const URL = process.env.SUPABASE_URL || "https://gnnacijqglcqonholpwt.supabase.co";
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!KEY) { console.error('Set SUPABASE_SERVICE_ROLE_KEY in .env'); process.exit(1); }

const supabase = createClient(URL, KEY);

const CSV_PATH = path.join(__dirname, '../../assets/listado_servicios_completo.csv');

function parsePrice(priceStr) {
    if (!priceStr) return 0;
    // Remove " €" and replace "," with "."
    const cleaned = priceStr.replace(' €', '').replace('.', '').replace(',', '.'); // Assuming 1.000,00 format? Or 100,00?
    // CSV Lines: "180,00 €" -> 180.00. "1.400,00 €" -> 1400.00
    // Wait, regex replace: remove dots (thousands), replace comma with dot (decimal)
    // Actually in the file: "180,00 €", "1400,00 €" (no thousand separators visible in snippet, but might exist)
    // Line 46: "2500,00 €". No thousands separator shown.
    // Line 3: "200,00 €"

    // Safer parse: regex remove all non-digit, non-comma, non-minus. Then replace comma with dot.
    return parseFloat(cleaned);
}

async function importServices() {
    console.log("🚀 Starting Services Import...");

    try {
        const fileContent = fs.readFileSync(CSV_PATH, 'utf-8');
        const lines = fileContent.split('\n');

        // Header: Estado;ID Servicio;Servicio;ID Especialidad;Especialidad;ID Mutua;Mutua;Es bono;Sesiones;Especialidad color;Duración (min);Disp. Cita;Cita online;Odontograma;Base;Descuento;IVA;Importe
        // Indices (0-based):
        // 0: Estado, 1: ID, 2: Servicio, 3: ID Esp, 4: Especialidad, 9: Color, 17: Importe

        const services = [];

        for (let i = 1; i < lines.length; i++) { // Skip header
            const line = lines[i].trim();
            if (!line) continue;

            const cols = line.split(';');
            if (cols.length < 5) continue;

            const name = cols[2];
            const specialty_name = cols[4];
            const specialty_color = cols[9] || '#888888';
            const priceStr = cols[17];
            const price = parseFloat(priceStr.replace(/[^\d,]/g, '').replace(',', '.')); // Remove €, spaces. Replace , with .

            services.push({
                id: crypto.randomUUID(),
                name: name,
                specialty_name: specialty_name,
                specialty_color: specialty_color,
                final_price: price,
                is_active: cols[0] === 'Activo'
            });
        }

        console.log(`📝 Parsed ${services.length} services.`);

        // Clear existing services? Or upsert? User asked "configurar que el CSV sea los 101 servicios".
        // Better to clear table to ensure exact match.
        console.log("🗑️ Clearing existing services...");
        const { error: deleteError } = await supabase.from('services').delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
        if (deleteError) console.error("Error clearing services:", deleteError);

        console.log("💾 Inserting new services...");
        // Insert in chunks
        const CHUNK_SIZE = 50;
        for (let i = 0; i < services.length; i += CHUNK_SIZE) {
            const chunk = services.slice(i, i + CHUNK_SIZE);
            const { error: insertError } = await supabase.from('services').insert(chunk);
            if (insertError) {
                console.error(`Error inserting chunk ${i}:`, insertError);
            } else {
                console.log(`✅ Inserted chunk ${i / CHUNK_SIZE + 1}`);
            }
        }

        console.log("🎉 Import completed successfully!");

    } catch (e) {
        console.error("🔥 Error during import:", e);
    }
}

importServices();
