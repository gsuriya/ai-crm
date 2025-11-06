-- Migration: Add company events monitoring tables
-- Stores events detected from various APIs (Apify, Proxycurl, Bright Data, Diffbot)

-- Create company_events table for storing detected events
CREATE TABLE IF NOT EXISTS company_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('apify_website', 'brightdata_linkedin', 'brightdata_social', 'diffbot_news')),
  event_category TEXT NOT NULL CHECK (event_category IN ('new_content', 'employee_change', 'job_posting', 'social_post', 'news_article', 'funding', 'other')),
  title TEXT NOT NULL,
  description TEXT,
  source_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  detected_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_new BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create company_monitoring_config table for monitoring settings
CREATE TABLE IF NOT EXISTS company_monitoring_config (
  company_id UUID PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  last_checked_at TIMESTAMP WITH TIME ZONE,
  apify_enabled BOOLEAN DEFAULT true,
  proxycurl_enabled BOOLEAN DEFAULT true,
  brightdata_enabled BOOLEAN DEFAULT true,
  diffbot_enabled BOOLEAN DEFAULT true,
  check_frequency_hours INTEGER DEFAULT 24,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_company_events_company_id ON company_events(company_id);
CREATE INDEX IF NOT EXISTS idx_company_events_event_type ON company_events(event_type);
CREATE INDEX IF NOT EXISTS idx_company_events_detected_at ON company_events(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_company_events_is_new ON company_events(is_new) WHERE is_new = true;
CREATE INDEX IF NOT EXISTS idx_company_events_company_is_new ON company_events(company_id, is_new) WHERE is_new = true;

-- Create function to update updated_at timestamp for company_monitoring_config
CREATE OR REPLACE FUNCTION update_company_monitoring_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_company_monitoring_config_updated_at
  BEFORE UPDATE ON company_monitoring_config
  FOR EACH ROW
  EXECUTE FUNCTION update_company_monitoring_config_updated_at();

