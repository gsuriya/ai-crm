-- Migration: Add logo_url field to companies table
-- Stores company logo URLs for display in the UI

ALTER TABLE companies ADD COLUMN IF NOT EXISTS logo_url TEXT;

