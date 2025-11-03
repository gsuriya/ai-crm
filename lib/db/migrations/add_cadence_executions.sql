-- Migration: Add cadence_executions table
-- Tracks active workflow executions with current position and scheduled times

-- Create cadence_executions table
CREATE TABLE IF NOT EXISTS cadence_executions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_cadence_id UUID NOT NULL REFERENCES company_cadences(id) ON DELETE CASCADE,
  current_block_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'paused', 'completed', 'error')) DEFAULT 'active',
  scheduled_for TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_cadence_executions_company_cadence_id ON cadence_executions(company_cadence_id);
CREATE INDEX IF NOT EXISTS idx_cadence_executions_status ON cadence_executions(status);
CREATE INDEX IF NOT EXISTS idx_cadence_executions_scheduled_for ON cadence_executions(scheduled_for) WHERE scheduled_for IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cadence_executions_current_block_id ON cadence_executions(current_block_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_cadence_executions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_cadence_executions_updated_at
  BEFORE UPDATE ON cadence_executions
  FOR EACH ROW
  EXECUTE FUNCTION update_cadence_executions_updated_at();

