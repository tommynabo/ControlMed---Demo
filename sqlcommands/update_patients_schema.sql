-- Migration to add split name fields and smoker status to patients table
-- Safe to run multiple times (idempotent)

DO $$ 
BEGIN 
    -- Add first_name if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'first_name') THEN
        ALTER TABLE patients ADD COLUMN first_name TEXT;
    END IF;

    -- Add last_name_1 if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'last_name_1') THEN
        ALTER TABLE patients ADD COLUMN last_name_1 TEXT;
    END IF;

    -- Add last_name_2 if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'last_name_2') THEN
        ALTER TABLE patients ADD COLUMN last_name_2 TEXT;
    END IF;

    -- Add smoker if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'smoker') THEN
        ALTER TABLE patients ADD COLUMN smoker BOOLEAN DEFAULT FALSE;
    END IF;

    -- Optional: Backfill first/last names from existing 'name' column if new columns are null
    -- This is a simple split, might not be perfect for all names but serves as a base
    UPDATE patients 
    SET 
        first_name = SPLIT_PART(name, ' ', 1),
        last_name_1 = SPLIT_PART(name, ' ', 2),
        last_name_2 = SPLIT_PART(name, ' ', 3)
    WHERE first_name IS NULL AND name IS NOT NULL;

END $$;
