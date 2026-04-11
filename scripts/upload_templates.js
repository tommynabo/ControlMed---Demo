const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const pdf = require('pdf-parse-new');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const ASSETS_DIR = path.join(__dirname, '../assets');
// HARDCODED FOR DEBUGGING
const SUPABASE_URL = process.env.SUPABASE_URL || "https://gnnacijqglcqonholpwt.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_KEY) { console.error('Set SUPABASE_SERVICE_ROLE_KEY in .env'); process.exit(1); }

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Error: Supabase credentials missing.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function uploadTemplates() {
    console.log('Starting PDF Template upload...');
    const files = fs.readdirSync(ASSETS_DIR).filter(f => f.toLowerCase().endsWith('.pdf'));

    let successCount = 0;

    for (const file of files) {
        const filePath = path.join(ASSETS_DIR, file);
        const fileBuffer = fs.readFileSync(filePath);

        try {
            // 1. Analyze for Title/Lang
            const data = await pdf(fileBuffer);
            const text = data.text.trim();

            // Heuristic Title
            let title = text.split('\n').find(l => l.trim().length > 5 && l.trim().length < 100) || file;
            title = title.replace(/[|]/g, '').trim(); // Clean up

            // Heuristic Lang
            let lang = 'Español';
            if (text.includes('Consentim') || text.includes('PACIENT')) lang = 'Catalán';
            if (text.includes('Consent') && text.includes('Patient')) lang = 'Inglés';
            if (text.includes('Français') || text.includes('Consentement')) lang = 'Francés';

            console.log(`Processing: ${file} -> ${title} (${lang})`);

            // 2. Upload to Storage
            // Check if bucket exists, if not create (requires admin, or valid bucket)
            // We assume 'templates' bucket exists or public is used. Let's try 'templates'.
            const storagePath = `pdfs/${file}`;
            const { error: uploadError } = await supabase.storage
                .from('templates')
                .upload(storagePath, fileBuffer, {
                    contentType: 'application/pdf',
                    upsert: true
                });

            if (uploadError) {
                // Check if it's just "Bucket not found"
                if (uploadError.message.includes('Bucket not found')) {
                    console.error("Error: Bucket 'templates' does not exist. Please create it in Supabase Dashboard (Public).");
                    process.exit(1);
                }
                console.error(`Upload error for ${file}:`, uploadError.message);
                continue;
            }

            const { data: { publicUrl } } = supabase.storage
                .from('templates')
                .getPublicUrl(storagePath);

            // 3. Insert into DB
            const { error: dbError } = await supabase
                .from('DocumentTemplate')
                .upsert({
                    title: `${title} [${lang}]`,
                    category: 'Legal',
                    content: text.substring(0, 500), // Store preview/content for search? Or just use raw path
                    type: 'pdf',
                    size: 'A4',
                    // We might need a URL field if schema doesn't have it. 
                    // Schema has: id, title, category, content, type, size. 
                    // We'll put URL in 'content' JSON or append to title? 
                    // Wait, schema definition showed 'content' as TEXT. 
                    // Let's check schema again. It has 'content'. 
                    // We'll store the Public URL in 'content' for now if it's a link type, or we might need to alter schema.
                    // Actually, 'content' usually implies the HTML/Text body.
                    // Since user wants to DOWNLOAD, storing URL is key. 
                    // I will store JSON string in content: { url: "...", extractedText: "..." }
                    content: JSON.stringify({ url: publicUrl, preview: text.substring(0, 200) })
                }, { onConflict: 'title' }); // Avoid dups by title? ideally ID. But for seeding title is okay.

            if (dbError) {
                console.error(`DB Insert error for ${file}:`, dbError.message);
            } else {
                console.log(`✅ Uploaded & Linked: ${title}`);
                successCount++;
            }

        } catch (e) {
            console.error(`Error processing ${file}:`, e.message);
        }
    }
    console.log(`Finished. Total uploaded: ${successCount}`);
}

uploadTemplates();
