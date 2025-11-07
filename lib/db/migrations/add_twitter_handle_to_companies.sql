-- Migration: Add twitter_handle column to companies table
-- Adds Twitter/X handle for social media monitoring

ALTER TABLE companies ADD COLUMN IF NOT EXISTS twitter_handle TEXT;

