-- Migration: Add month field to company_financials for monthly tracking
-- Allows tracking ARR and retention by month/year

-- Add month column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'company_financials' 
    AND column_name = 'month'
  ) THEN
    ALTER TABLE company_financials ADD COLUMN month INTEGER CHECK (month >= 1 AND month <= 12);
    
    -- Update unique constraint to include month
    ALTER TABLE company_financials DROP CONSTRAINT IF EXISTS company_financials_company_id_year_key;
    ALTER TABLE company_financials ADD CONSTRAINT company_financials_company_id_year_month_key 
      UNIQUE(company_id, year, month);
    
    -- Set default month to null for existing records (yearly data)
    -- New records can specify month for monthly tracking
  END IF;
END $$;

-- Add index for faster queries by month
CREATE INDEX IF NOT EXISTS idx_company_financials_month ON company_financials(month);

