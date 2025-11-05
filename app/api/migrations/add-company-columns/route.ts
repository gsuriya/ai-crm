import { NextRequest, NextResponse } from 'next/server';

/**
 * Migration API route to add description and linkedin_url columns to companies table
 * Executes DDL directly via Supabase Postgres connection
 * 
 * Usage: POST /api/migrations/add-company-columns
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
      ALTER TABLE companies ADD COLUMN IF NOT EXISTS description TEXT;
      ALTER TABLE companies ADD COLUMN IF NOT EXISTS linkedin_url TEXT;
    `;

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
          message: 'Migration executed successfully! Columns added to companies table.' 
        });
      } catch (error: any) {
        // If pg is not installed or connection fails, provide instructions
        if (error.code === 'MODULE_NOT_FOUND') {
          console.log('pg module not found, providing manual instructions');
        } else {
          console.error('Database connection error:', error);
        }
      }
    }

    // Fallback: Return SQL for manual execution
    return NextResponse.json({
      success: false,
      message: 'Please run this SQL manually in Supabase SQL Editor',
      sql: sql.trim(),
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
        sql: `ALTER TABLE companies ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS linkedin_url TEXT;`,
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

