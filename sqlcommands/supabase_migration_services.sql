-- Migration: Create services table for clinical services
-- Run this in Supabase SQL Editor

-- Create services table
CREATE TABLE IF NOT EXISTS services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(50),
    name VARCHAR(255) NOT NULL,
    specialty_id VARCHAR(50),
    specialty_name VARCHAR(100),
    specialty_color VARCHAR(20) DEFAULT '#3b638e',
    duration_min INTEGER DEFAULT 30,
    base_price DECIMAL(10,2) NOT NULL DEFAULT 0,
    discount_percent DECIMAL(5,2) DEFAULT 0,
    tax_percent DECIMAL(5,2) DEFAULT 0,
    final_price DECIMAL(10,2) NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    odontogram_type VARCHAR(50) DEFAULT 'Color servicio',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_services_specialty ON services(specialty_name);
CREATE INDEX IF NOT EXISTS idx_services_active ON services(is_active);

-- Enable RLS
ALTER TABLE services ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users
CREATE POLICY "Allow all for authenticated users" ON services
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Create policy for anon users (read-only for public services list)
CREATE POLICY "Allow read for anon" ON services
    FOR SELECT
    TO anon
    USING (is_active = true);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_services_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER services_updated_at
    BEFORE UPDATE ON services
    FOR EACH ROW
    EXECUTE FUNCTION update_services_updated_at();
