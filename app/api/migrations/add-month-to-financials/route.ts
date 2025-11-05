import { NextRequest, NextResponse } from 'next/server';

/**
 * Migration API route to add month field to company_financials table
 * Executes DDL directly via Supabase Postgres connection
 * 
 * Usage: POST /api/migrations/add-month-to-financials
 */
export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const dbPassword = process.env.SUPABASE_DB_PASSWORD;

    if (!supabaseUrl) {
      return NextResponse.json(
        { error: 'Missing NEXT_PUBLIC_SUPABASE_URL' },
        { status: 500 }
      );
    }

    // Extract project ref from URL
    const urlMatch = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/);
    if (!urlMatch) {
      return NextResponse.json(
        { error: 'Invalid Supabase URL format' },
        { status: 500 }
      );
    }

    const projectRef = urlMatch[1];
    const dbHost = `db.${projectRef}.supabase.co`;
    const dbPort = 5432;
    const dbUser = 'postgres';
    const dbName = 'postgres';

    // SQL migration
    const sql = `
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
    `.trim();

    // Use direct Postgres connection with pg library
    if (dbPassword) {
      try {
        // Dynamic import of pg to avoid requiring it at build time
        const { Client } = await import('pg');
        
        const client = new Client({
          host: dbHost,
          port: dbPort,
          user: dbUser,
          password: dbPassword,
          database: dbName,
          ssl: {
            rejectUnauthorized: false
          }
        });

        await client.connect();
        await client.query(sql);
        await client.end();

        return NextResponse.json({ 
          success: true, 
          message: 'Migration executed successfully! Month column added to company_financials table.' 
        });
      } catch (error: any) {
        console.error('Database connection error:', error);
        // Fall through to provide manual instructions
      }
    }

    // Fallback: Return SQL for manual execution
    return NextResponse.json({
      success: false,
      message: 'Please run this SQL manually in Supabase SQL Editor',
      sql: sql,
      instructions: [
        '1. Go to your Supabase dashboard',
        '2. Navigate to SQL Editor',
        '3. Copy and paste the SQL above',
        '4. Click "Run" to execute',
      ]
    });
  } catch (error: any) {
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Failed to run migration',
        sql: `-- Add month column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'company_financials' 
    AND column_name = 'month'
  ) THEN
    ALTER TABLE company_financials ADD COLUMN month INTEGER CHECK (month >= 1 AND month <= 12);
    
    ALTER TABLE company_financials DROP CONSTRAINT IF EXISTS company_financials_company_id_year_key;
    ALTER TABLE company_financials ADD CONSTRAINT company_financials_company_id_year_month_key 
      UNIQUE(company_id, year, month);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_company_financials_month ON company_financials(month);`,
        instructions: [
          '1. Go to your Supabase dashboard',
          '2. Navigate to SQL Editor',
          '3. Copy and paste the SQL above',
          '4. Click "Run" to execute',
        ]
      },
      { status: 500 }
    );
  }
}

