#!/usr/bin/env node
/**
 * Seed script: imports consent documents from Docs/ folder into the DocumentTemplate table.
 * Uses Supabase JS (service role key) — no direct PostgreSQL or running server needed.
 *
 * Run: node scripts/seed-templates.js
 * Safe to re-run: skips titles that already exist.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
let pdfParse;
try {
    pdfParse = require('pdf-parse');
    if (typeof pdfParse !== 'function') pdfParse = pdfParse.default || pdfParse;
} catch { pdfParse = null; }
const { createClient } = require('@supabase/supabase-js');
const { randomUUID } = require('crypto');

const DOCS_DIR = path.join(__dirname, '../Docs');
const CATEGORY = 'Consentimiento Informado';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Supabase/Prisma table name (Prisma model "DocumentTemplate" → table "DocumentTemplate")
const TABLE = 'DocumentTemplate';

async function convertDocxToHtml(filePath) {
    const result = await mammoth.convertToHtml({ path: filePath });
    if (result.messages && result.messages.length > 0) {
        result.messages.forEach(m => {
            if (m.type !== 'warning' || !m.message.includes('unrecognised')) {
                console.warn('  [mammoth]', m.message);
            }
        });
    }
    return result.value;
}

async function convertPdfToHtml(filePath) {
    if (!pdfParse || typeof pdfParse !== 'function') {
        // Fallback: read as binary and note it couldn't be parsed
        return `<p><em>Documento PDF: ${path.basename(filePath)}</em></p><p>El contenido de este PDF no pudo convertirse automáticamente. Por favor, edita esta plantilla para añadir el texto manualmente.</p>`;
    }
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    const html = data.text
        .split(/\n{2,}/)
        .map(block => block.trim())
        .filter(block => block.length > 0)
        .map(block => `<p>${block.replace(/\n/g, '<br>')}</p>`)
        .join('\n');
    return html;
}

async function getExistingTitles() {
    const { data, error } = await supabase
        .from(TABLE)
        .select('title');
    if (error) throw new Error(`Error fetching existing templates: ${error.message}`);
    return new Set((data || []).map(t => t.title));
}

async function seedTemplate(filename, existingTitles) {
    const filePath = path.join(DOCS_DIR, filename);
    const ext = path.extname(filename).toLowerCase();
    const title = path.basename(filename, ext);

    if (existingTitles.has(title)) {
        console.log(`  ⏭  Ya existe: "${title}" — omitiendo.`);
        return;
    }

    console.log(`  📄 Procesando: ${filename}`);
    let html = '';
    try {
        if (ext === '.docx') {
            html = await convertDocxToHtml(filePath);
        } else if (ext === '.pdf') {
            html = await convertPdfToHtml(filePath);
        } else {
            console.warn(`  ⚠️  Formato no soportado: ${filename} — omitiendo.`);
            return;
        }
    } catch (err) {
        console.error(`  ❌ Error al convertir ${filename}:`, err.message);
        return;
    }

    const sizeStr = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(2) + ' KB';

    const { error } = await supabase.from(TABLE).insert({
        id: randomUUID(),
        title,
        category: CATEGORY,
        type: 'html',
        size: sizeStr,
        content: html,
    });

    if (error) {
        console.error(`  ❌ Error al guardar "${title}":`, error.message);
    } else {
        console.log(`  ✅ Importado: "${title}" (${sizeStr})`);
    }
}

async function main() {
    console.log('\n🌱 Iniciando importación de plantillas de consentimiento...\n');

    if (!fs.existsSync(DOCS_DIR)) {
        console.error(`❌ No se encontró la carpeta Docs en: ${DOCS_DIR}`);
        process.exit(1);
    }

    const files = fs.readdirSync(DOCS_DIR).filter(f => {
        const ext = path.extname(f).toLowerCase();
        return ext === '.docx' || ext === '.pdf';
    });

    if (files.length === 0) {
        console.warn('⚠️  No se encontraron archivos .docx o .pdf en la carpeta Docs/');
        process.exit(0);
    }

    console.log(`📂 Encontrados ${files.length} archivos en Docs/\n`);

    const existingTitles = await getExistingTitles();

    for (const file of files) {
        await seedTemplate(file, existingTitles);
    }

    const { count } = await supabase
        .from(TABLE)
        .select('*', { count: 'exact', head: true })
        .eq('category', CATEGORY);

    console.log(`\n✅ Importación completada. Consentimientos en el gestor: ${count ?? '?'}\n`);
}

main().catch(err => {
    console.error('\n❌ Error fatal:', err.message);
    process.exit(1);
});
