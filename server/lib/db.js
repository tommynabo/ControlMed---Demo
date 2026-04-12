'use strict';
const { PrismaClient } = require('@prisma/client');
const { createClient } = require('@supabase/supabase-js');

// ─── Prisma Singleton ─────────────────────────────────────────────────────────
const prisma = global.__prisma || new PrismaClient({
    log: process.env.NODE_ENV === 'production'
        ? ['warn', 'error']
        : ['query', 'info', 'warn', 'error'],
    datasources: { db: { url: process.env.DATABASE_URL } },
});

if (process.env.NODE_ENV !== 'production') {
    global.__prisma = prisma;
}

prisma.$connect()
    .then(() => {
        const dbUrl = process.env.DATABASE_URL || 'Unknown';
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
