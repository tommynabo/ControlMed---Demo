#!/usr/bin/env node
/**
 * Execute SQL migration to add address fields to Patient table
 * Usage: node scripts/execute_add_address.js
 */

'use strict';

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/"/g, '').trim();
const DB_PASSWORD = (process.env.POSTGRES_PASSWORD || '').replace(/"/g, '').trim();

if (!SUPABASE_URL || !DB_PASSWORD) {
  console.error('❌ Missing SUPABASE_URL or POSTGRES_PASSWORD in environment');
  process.exit(1);
}

// Extract host from Supabase URL (e.g., https://xyzabc.supabase.co -> xyzabc.supabase.co)
const host = SUPABASE_URL.replace('https://', '').replace('http://', '');
const dbHost = host.replace('/', '');

console.log('🔄 Executing migration to add address fields...\n');

// SQL commands to execute
const sqlFile = path.join(__dirname, '..', 'sqlcommands', 'add_address_to_patient.sql');
const sql = fs.readFileSync(sqlFile, 'utf8');

// Use psql to execute SQL
const psql = spawn('psql', [
  `postgresql://postgres:${DB_PASSWORD}@${dbHost}:5432/postgres`,
  '-c',
  sql
], {
  stdio: ['pipe', 'pipe', 'pipe'],
  shell: true
});

let output = '';
let errorOutput = '';

psql.stdout.on('data', (data) => {
  output += data.toString();
  process.stdout.write(data);
});

psql.stderr.on('data', (data) => {
  errorOutput += data.toString();
  process.stderr.write(data);
});

psql.on('close', (code) => {
  if (code === 0) {
    console.log('\n✅ Migration completed successfully!');
    console.log('✔ Columns added: address, city, postalCode, province');
  } else {
    console.error('\n❌ Migration failed');
    process.exit(1);
  }
});
