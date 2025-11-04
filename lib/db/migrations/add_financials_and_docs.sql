-- Migration: Add financials and pitch deck storage
-- Extends existing schema with financial data and document management

-- Create company_financials table for financial metrics
CREATE TABLE IF NOT EXISTS company_financials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  year INTEGER NOT NULL CHECK (year >= 2000 AND year <= 2100),
  arr NUMERIC,
  gross_retention NUMERIC CHECK (gross_retention >= 0 AND gross_retention <= 200),
  net_retention NUMERIC CHECK (net_retention >= 0 AND net_retention <= 300),
  gross_margin NUMERIC CHECK (gross_margin >= -100 AND gross_margin <= 100),
  ebitda NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(company_id, year)
);

-- Create company_pitch_decks table for pitch deck documents
CREATE TABLE IF NOT EXISTS company_pitch_decks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  uploaded_by UUID REFERENCES auth.users(id),
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  version INTEGER DEFAULT 1,
  notes TEXT
);

-- Create email_logs table if it doesn't exist (for email history)
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  cadence_id UUID,
  direction TEXT NOT NULL CHECK (direction IN ('sent', 'received')),
  subject TEXT,
  body TEXT,
  from_email TEXT NOT NULL,
  to_email TEXT NOT NULL,
  thread_id TEXT,
  message_id TEXT,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  received_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create call_logs table for call transcriptions and notes
CREATE TABLE IF NOT EXISTS call_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  cadence_id UUID,
  call_type TEXT CHECK (call_type IN ('voice_call', 'voicemail')),
  direction TEXT CHECK (direction IN ('outbound', 'inbound')),
  phone_number TEXT,
  vapi_call_id TEXT,
  transcription TEXT,
  notes TEXT,
  duration_seconds INTEGER,
  status TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_company_financials_company_id ON company_financials(company_id);
CREATE INDEX IF NOT EXISTS idx_company_financials_year ON company_financials(year);
CREATE INDEX IF NOT EXISTS idx_company_pitch_decks_company_id ON company_pitch_decks(company_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_company_id ON email_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_thread_id ON email_logs(thread_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON email_logs(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_logs_company_id ON call_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_created_at ON call_logs(created_at DESC);

-- Create function to update updated_at timestamp for company_financials
CREATE OR REPLACE FUNCTION update_company_financials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_company_financials_updated_at
  BEFORE UPDATE ON company_financials
  FOR EACH ROW
  EXECUTE FUNCTION update_company_financials_updated_at();


