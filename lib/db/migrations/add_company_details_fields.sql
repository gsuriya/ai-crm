-- Migration: Add company details fields
-- Adds description, linkedin_url columns to companies table

ALTER TABLE companies ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS linkedin_url TEXT;

