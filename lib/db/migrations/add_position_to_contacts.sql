-- Migration: Add position column to contacts table
-- The UI uses 'position' but the table has 'title', so we'll add position for consistency

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS position TEXT;


