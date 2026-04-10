#!/usr/bin/env node
/**
 * Migration: Add is_revision column to Appointment table
 * Run once with: node add_revision_column.js
 */
const https = require('https');

const SUPABASE_URL = 'https://gnnacijqglcqonholpwt.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdubmFjaWpxZ2xjcW9uaG9scHd0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ3NjU0NCwiZXhwIjoyMDg0MDUyNTQ0fQ.6qexkezsBpOhvTch_eRsr8lF_mixdp9sfv0ScjUmxp4';

// Test if column already exists by trying to select it
const testUrl = `${SUPABASE_URL}/rest/v1/Appointment?select=is_revision&limit=1`;

const options = {
  method: 'GET',
  headers: {
    'apikey': SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json'
  }
};

function makeRequest(url, opts, body = null) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: opts.method,
      headers: opts.headers
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, body: data });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function migrate() {
  console.log('🔍 Checking if is_revision column exists...');
  const test = await makeRequest(testUrl, options);
  
  if (test.status === 200) {
    console.log('✅ Column is_revision already exists! No migration needed.');
    return;
  }
  
  if (test.body.includes('is_revision')) {
    console.log('✅ Column is_revision already exists!');
    return;
  }
  
  console.log('❌ Column does not exist. Status:', test.status);
  console.log('📋 Please run this SQL in your Supabase dashboard (SQL Editor):');
  console.log('');
  console.log('ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS is_revision BOOLEAN DEFAULT FALSE;');
  console.log('');
  console.log('Dashboard URL: https://supabase.com/dashboard/project/gnnacijqglcqonholpwt/sql/new');
}

migrate();
