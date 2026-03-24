-- Add new columns to the appointments table to support enhanced booking details
ALTER TABLE appointments 
ADD COLUMN IF NOT EXISTS observation TEXT,
ADD COLUMN IF NOT EXISTS price NUMERIC,
ADD COLUMN IF NOT EXISTS duration INTEGER DEFAULT 15;

-- Optional: If you want to ensure duration is never null
UPDATE appointments SET duration = 15 WHERE duration IS NULL;
