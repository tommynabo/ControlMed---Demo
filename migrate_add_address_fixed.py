#!/usr/bin/env python3
"""
Execute SQL migration to add address fields to Patient table in Supabase
Using DATABASE_URL for connection
"""

import os
import psycopg2
from dotenv import load_dotenv
import sys
from pathlib import Path
from urllib.parse import urlparse

# Load environment variables
env_path = Path(__file__).parent / '.env'
load_dotenv(env_path)

# Try DATABASE_URL first, then DIRECT_URL
database_url = os.getenv('DATABASE_URL', '').strip()
if not database_url:
    database_url = os.getenv('DIRECT_URL', '').strip()

if not database_url:
    print('❌ Missing DATABASE_URL or DIRECT_URL in environment')
    sys.exit(1)

# Parse the DATABASE_URL
try:
    parsed = urlparse(database_url)
    db_host = parsed.hostname
    db_port = parsed.port or 5432
    db_user = parsed.username
    db_password = parsed.password
    db_name = parsed.path.lstrip('/') if parsed.path else 'postgres'
    
    # Try to parse SSL mode from query params if present
    sslmode = 'require'
    if parsed.query:
        if 'sslmode' in parsed.query:
            for param in parsed.query.split('&'):
                if param.startswith('sslmode='):
                    sslmode = param.split('=')[1]
    
    print(f'🔄 Connecting to {db_host}:{db_port}...')
    print(f'   User: {db_user}')
    print(f'   Database: {db_name}')
    print(f'   SSL Mode: {sslmode}')
    
    conn = psycopg2.connect(
        dbname=db_name,
        user=db_user,
        password=db_password,
        host=db_host,
        port=db_port,
        sslmode=sslmode,
        connect_timeout=10
    )
    
    cursor = conn.cursor()
    print('✅ Connected to database')
    
    # Execute migrations
    migrations = [
        ('ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "address" TEXT;', 'address'),
        ('ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "city" TEXT;', 'city'),
        ('ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "postalCode" TEXT;', 'postalCode'),
        ('ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "province" TEXT;', 'province'),
    ]
    
    print('\n📋 Adding address fields to Patient table...\n')
    
    for sql, col_name in migrations:
        try:
            cursor.execute(sql)
            print(f'✅ Added column: {col_name}')
        except psycopg2.Error as e:
            if 'already exists' in str(e):
                print(f'ℹ️  Column {col_name} already exists')
            else:
                print(f'⚠️  Error: {e}')
    
    conn.commit()
    cursor.close()
    conn.close()
    
    print('\n✅ Migration completed successfully!')
    print('✔ Columns available: address, city, postalCode, province')
    
except psycopg2.Error as e:
    print(f'❌ Database error: {e}')
    sys.exit(1)
except Exception as e:
    print(f'❌ Error: {e}')
    sys.exit(1)
