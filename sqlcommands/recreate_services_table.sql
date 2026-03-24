-- Recreate the services table that was deleted by Prisma db push

CREATE TABLE IF NOT EXISTS public.services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    specialty_name TEXT,
    specialty_color TEXT DEFAULT '#888888',
    final_price DECIMAL(10,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated read access
CREATE POLICY "Allow authenticated read access" ON public.services
    FOR SELECT
    TO authenticated
    USING (true);

-- Create policy for authenticated insert
CREATE POLICY "Allow authenticated insert" ON public.services
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Create policy for authenticated update  
CREATE POLICY "Allow authenticated update" ON public.services
    FOR UPDATE
    TO authenticated
    USING (true);

-- Create policy for authenticated delete
CREATE POLICY "Allow authenticated delete" ON public.services
    FOR DELETE
    TO authenticated
    USING (true);

-- Also create policy for service_role (used by backend)
CREATE POLICY "Allow service role full access" ON public.services
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Grant permissions
GRANT ALL ON public.services TO authenticated;
GRANT ALL ON public.services TO service_role;
