#!/usr/bin/env python3
"""
Execute SQL migration to add address fields to Patient table in Supabase
Usage: python3 scripts/migrate_add_address.py
"""

import os
import psycopg2
from dotenv import load_dotenv
import sys
from pathlib import Path

# Load environment variables
env_path = Path(__file__).parent.parent / 'server' / '.env'
load_dotenv(env_path)

env_path = Path(__file__).parent.parent / '.env'
load_dotenv(env_path)

# Get database connection from DATABASE_URL
database_url = os.getenv('DATABASE_URL', '').replace('"', '').strip()

if not database_url:
    print('❌ Missing DATABASE_URL in environment')
    sys.exit(1)

# Parse connection string: postgresql://user:password@host:port/database
try:
    # Remove scheme
    parts = database_url.replace('postgresql://', '').split('@')
    if len(parts) != 2:
        raise ValueError("Invalid DATABASE_URL format")
    
    credentials = parts[0]
    host_db = parts[1]
    user, password = credentials.split(':')
    
    # Extract host and port
    host_port_db = host_db.split('/')[0]
    host_parts = host_port_db.split(':')
    host = host_parts[0]
    port = host_parts[1] if len(host_parts) > 1 else '6543'
    
    print('🔄 Connecting to Supabase PostgreSQL database...')
    print(f'   Host: {host}:{port}')
    
    conn = psycopg2.connect(
        dbname='postgres',
        user=user,
        password=password,
        host=host,
        port=int(port),
        sslmode='require',
        connect_timeout=10
    )
    
    cursor = conn.cursor()
    print('✅ Connected to Supabase')
    
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
