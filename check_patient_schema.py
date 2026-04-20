#!/usr/bin/env python3
"""
Script to connect to Supabase and check the schema of the 'Patient' table.
"""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import RealDictCursor
from tabulate import tabulate

# Load environment variables from .env - check server/.env first
env_paths = [
    Path("/Users/tomas/Downloads/DOCUMENTOS/CRM MEDICO/server/.env"),
    Path("/Users/tomas/Downloads/DOCUMENTOS/CRM MEDICO/.env"),
]

for env_path in env_paths:
    if env_path.exists():
        print(f"✓ Loading environment from: {env_path}")
        load_dotenv(env_path)
        break
else:
    print("✗ No .env file found in expected locations")
    sys.exit(1)

# Get database connection string - prefer DIRECT_URL first
database_url = os.getenv("DIRECT_URL") or os.getenv("DATABASE_URL")

if not database_url:
    print("✗ DATABASE_URL or DIRECT_URL not found in environment variables")
    sys.exit(1)

print(f"✓ Connecting to database...")

try:
    # Connect to the database
    conn = psycopg2.connect(database_url)
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    # Query the information_schema for the Patient table
    query = """
    SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default,
        character_maximum_length,
        numeric_precision,
        numeric_scale
    FROM information_schema.columns
    WHERE table_name = 'Patient'
    ORDER BY ordinal_position;
    """
    
    cursor.execute(query)
    columns = cursor.fetchall()
    
    if not columns:
        print("✗ No 'Patient' table found or table has no columns")
        
        # List all tables to help debug
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name;
        """)
        tables = cursor.fetchall()
        if tables:
            print("\nAvailable tables in public schema:")
            for table in tables:
                print(f"  - {table['table_name']}")
    else:
        print(f"\n✓ Found {len(columns)} columns in 'Patient' table:\n")
        
        # Format the output
        headers = ["Column Name", "Data Type", "Nullable", "Default", "Max Length", "Precision", "Scale"]
        rows = []
        
        for col in columns:
            rows.append([
                col['column_name'],
                col['data_type'],
                col['is_nullable'],
                col['column_default'] if col['column_default'] else "—",
                col['character_maximum_length'] if col['character_maximum_length'] else "—",
                col['numeric_precision'] if col['numeric_precision'] else "—",
                col['numeric_scale'] if col['numeric_scale'] else "—",
            ])
        
        # Print formatted table
        print(tabulate(rows, headers=headers, tablefmt="grid"))
        
        # Print summary
        print(f"\nColumn Summary:")
        for col in columns:
            nullable = "✓ NULL" if col['is_nullable'] == 'YES' else "✗ NOT NULL"
            print(f"  {col['column_name']:30} {col['data_type']:20} [{nullable}]")
    
    cursor.close()
    conn.close()
    print("\n✓ Connection closed successfully")

except psycopg2.Error as e:
    print(f"✗ Database error: {e}")
    sys.exit(1)
except Exception as e:
    print(f"✗ Error: {e}")
    sys.exit(1)

