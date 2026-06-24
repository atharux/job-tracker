-- Add industry field extracted by classifier

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS industry TEXT;
