-- Migration: Add contact_id column to company_cadences table
-- Allows linking a specific contact to a company-cadence association

ALTER TABLE company_cadences ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_company_cadences_contact_id ON company_cadences(contact_id) WHERE contact_id IS NOT NULL;

