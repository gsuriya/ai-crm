import { NextRequest, NextResponse } from 'next/server';

/**
 * Migration API route to add contact_id column to company_cadences table
 * Executes DDL directly via Supabase Postgres connection
 * 
 * Usage: POST /api/migrations/add-contact-id
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
      ALTER TABLE company_cadences ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;
      CREATE INDEX IF NOT EXISTS idx_company_cadences_contact_id ON company_cadences(contact_id) WHERE contact_id IS NOT NULL;
    `;

    // Use direct Postgres connection with pg library
    if (dbPassword) {
      try {
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
          message: 'Migration executed successfully! Added contact_id column to company_cadences table.' 
        });
      } catch (error: any) {
        if (error.code === 'MODULE_NOT_FOUND') {
          return NextResponse.json({
            success: false,
            error: 'pg library not installed',
            message: 'Please install pg: npm install pg @types/pg',
            sql: sql
          }, { status: 400 });
        }
        throw error;
      }
    }

    return NextResponse.json({
      success: false,
      error: 'Missing SUPABASE_DB_PASSWORD',
      message: 'Please add SUPABASE_DB_PASSWORD to .env.local',
      sql: sql
    }, { status: 400 });

  } catch (error: any) {
    console.error('Migration route error:', error);
    return NextResponse.json(
      { 
        error: error.message,
        sql: 'ALTER TABLE company_cadences ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;'
      },
      { status: 500 }
    );
  }
}

