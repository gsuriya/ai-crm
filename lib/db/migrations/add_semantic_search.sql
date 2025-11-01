-- Migration: Add semantic search capabilities
-- Extends existing schema with unified content storage and vector embeddings

-- Add structured fields to companies table
ALTER TABLE companies ADD COLUMN IF NOT EXISTS arr NUMERIC;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS founding_date DATE;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS funding_amount NUMERIC;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS funding_round TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS industry TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS employee_count INTEGER;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS headquarters TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS website TEXT;

-- Create company_content table - unified storage for all unstructured data
CREATE TABLE IF NOT EXISTS company_content (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN (
    'meeting_log', 'email', 'memo', 'note', 'google_doc', 
    'document', 'pdf', 'call_transcript', 'outreach_log', 'other'
  )),
  content TEXT NOT NULL,
  source TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  embedding vector(1536), -- OpenAI embedding dimension
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create company_metadata table - flexible key-value store
CREATE TABLE IF NOT EXISTS company_metadata (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT,
  value_numeric NUMERIC,
  value_json JSONB,
  embedding vector(1536), -- Only for text values
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(company_id, key)
);

-- Create documents table - references to external documents
CREATE TABLE IF NOT EXISTS documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN (
    'google_doc', 'pdf', 'word', 'excel', 'other'
  )),
  external_id TEXT NOT NULL, -- Google Doc ID, file path, etc.
  title TEXT,
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  content_hash TEXT, -- For detecting changes
  UNIQUE(company_id, external_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_company_content_company_id ON company_content(company_id);
CREATE INDEX IF NOT EXISTS idx_company_content_type ON company_content(content_type);
CREATE INDEX IF NOT EXISTS idx_company_content_created_at ON company_content(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_company_content_embedding ON company_content USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_company_metadata_company_id ON company_metadata(company_id);
CREATE INDEX IF NOT EXISTS idx_company_metadata_key ON company_metadata(key);
CREATE INDEX IF NOT EXISTS idx_company_metadata_embedding ON company_metadata USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_documents_company_id ON documents(company_id);
CREATE INDEX IF NOT EXISTS idx_documents_external_id ON documents(external_id);

-- Create function to update updated_at timestamp for company_content
CREATE OR REPLACE FUNCTION update_company_content_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_company_content_updated_at
  BEFORE UPDATE ON company_content
  FOR EACH ROW
  EXECUTE FUNCTION update_company_content_updated_at();

-- Create function to generate embeddings (placeholder - will be called from application)
CREATE OR REPLACE FUNCTION generate_embedding(text_content TEXT)
RETURNS vector(1536) AS $$
BEGIN
  -- This function will be called from the application layer
  -- The actual embedding generation happens in TypeScript/Node.js
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create view for semantic search results
CREATE OR REPLACE VIEW semantic_search_results AS
SELECT 
  c.id as company_id,
  c.name as company_name,
  content.id as content_id,
  content.content_type,
  content.content,
  content.source,
  content.metadata,
  content.created_at as content_date,
  NULL as metadata_key,
  NULL as metadata_value
FROM companies c
JOIN company_content content ON c.id = content.company_id
WHERE content.embedding IS NOT NULL
UNION ALL
SELECT 
  c.id as company_id,
  c.name as company_name,
  NULL as content_id,
  'metadata' as content_type,
  meta.value as content,
  NULL as source,
  jsonb_build_object('key', meta.key) as metadata,
  meta.created_at as content_date,
  meta.key as metadata_key,
  meta.value as metadata_value
FROM companies c
JOIN company_metadata meta ON c.id = meta.company_id
WHERE meta.embedding IS NOT NULL;

