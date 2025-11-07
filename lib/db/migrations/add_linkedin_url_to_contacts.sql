-- Migration: Add linkedin_url column to contacts table
-- Adds LinkedIn profile URL field for contact management

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS linkedin_url TEXT;

