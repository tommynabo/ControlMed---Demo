'use strict';
const { PrismaClient } = require('@prisma/client');
const { createClient } = require('@supabase/supabase-js');

function appendQueryParam(url, key, value) {
    const hasQuery = url.includes('?');
    const hasHash = url.includes('#');
    if (hasHash) {
        const [base, hash] = url.split('#');
        return `${base}${hasQuery ? '&' : '?'}${key}=${value}#${hash}`;
    }
    return `${url}${hasQuery ? '&' : '?'}${key}=${value}`;
}

function extractSupabaseProjectRefFromUrl(url) {
    if (!url) return null;
    const match = String(url).match(/https?:\/\/([a-z0-9-]+)\.supabase\.co/i);
    return match ? match[1] : null;
}

function getPrismaDatabaseUrl() {
    let url = process.env.DATABASE_URL || process.env.DIRECT_URL;
    if (!url) {
        throw new Error('Missing DATABASE_URL (or DIRECT_URL) in environment variables');
    }

    // Supabase direct Postgres requires TLS in serverless environments.
    if (/db\.[a-z0-9-]+\.supabase\.co(:\d+)?/i.test(url) && !/sslmode=/i.test(url)) {
        url = appendQueryParam(url, 'sslmode', 'require');
    }

    return url;
}

function assertDemoProdConsistency(databaseUrl) {
    const supabaseRef = extractSupabaseProjectRefFromUrl(process.env.SUPABASE_URL);
    if (!supabaseRef || !databaseUrl) return;

    // Detect obvious mismatch: SUPABASE_URL points to one project, Prisma URL to another.
    const containsSupabaseRef = databaseUrl.includes('.supabase.co') && databaseUrl.includes(supabaseRef);
    if (!containsSupabaseRef) {
        console.warn(
            `⚠️ Supabase project mismatch detected: SUPABASE_URL ref='${supabaseRef}' but DATABASE_URL points elsewhere.`
        );
    }

    if (process.env.DEMO_RESET_SECRET && /gnnacijqglcqonholpwt/i.test(databaseUrl)) {
        throw new Error('Safety check blocked startup: demo mode cannot use production DATABASE_URL');
    }
}

// ─── Prisma Singleton ─────────────────────────────────────────────────────────
const prismaDbUrl = getPrismaDatabaseUrl();
assertDemoProdConsistency(prismaDbUrl);

const prisma = global.__prisma || new PrismaClient({
    log: process.env.NODE_ENV === 'production'
        ? ['warn', 'error']
        : ['query', 'info', 'warn', 'error'],
    datasources: { db: { url: prismaDbUrl } },
});

if (process.env.NODE_ENV !== 'production') {
    global.__prisma = prisma;
}

prisma.$connect()
    .then(() => {
        const dbUrl = prismaDbUrl || 'Unknown';
        const maskedUrl = dbUrl.replace(/:([^:@]+)@/, ':****@');
        console.log(`✅ DB connected [${process.env.NODE_ENV || 'DEV'}] ${maskedUrl}`);
    })
    .catch((e) => {
        console.error('❌ DB connection error:', e.message);
    });

// ─── Supabase Singleton ───────────────────────────────────────────────────────
let _supabase = null;

function getSupabase() {
    if (_supabase) return _supabase;
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment variables');
    }
    _supabase = createClient(url, key);
    return _supabase;
}

module.exports = { prisma, getSupabase };
