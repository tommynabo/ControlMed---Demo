-- Add duration column (integer, minutes) if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'duration') THEN
        ALTER TABLE appointments ADD COLUMN duration INTEGER DEFAULT 30;
    END IF;
END $$;

-- Add budget_item_id column (text) if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'budget_item_id') THEN
        ALTER TABLE appointments ADD COLUMN budget_item_id TEXT;
    END IF;
END $$;

-- Add amount column (numeric) if it doesn't exist (it should, but just in case)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'amount') THEN
        ALTER TABLE appointments ADD COLUMN amount NUMERIC(10, 2);
    END IF;
END $$;

-- Add paid column (boolean) if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'paid') THEN
        ALTER TABLE appointments ADD COLUMN paid BOOLEAN DEFAULT FALSE;
    END IF;
END $$;
