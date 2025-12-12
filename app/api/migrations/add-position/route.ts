import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Migration API route to add position column to contacts table
 * Executes DDL directly via Supabase Postgres connection
 * 
 * Usage: POST /api/migrations/add-position
 */
export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const dbPassword = process.env.SUPABASE_DB_PASSWORD;

    if (!supabaseUrl) {
      return NextResponse.json(
        { error: 'Missing NEXT_PUBLIC_SUPABASE_URL' },
        { status: 500 }
      );
    }

    // Extract project ref from URL (e.g., https://vcecetcumnreuzojtqin.supabase.co)
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
    const sql = 'ALTER TABLE contacts ADD COLUMN IF NOT EXISTS position TEXT;';

    // Try to execute via Supabase REST API using service role key
    if (supabaseServiceKey) {
      try {
        // Use Supabase's Management API to execute SQL
        // This requires the service role key
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ sql }),
        });

        if (response.ok) {
          return NextResponse.json({ 
            success: true, 
            message: 'Migration executed successfully!' 
          });
        }
      } catch (error) {
        // Fall through to pg connection method
      }
    }

    // Method 2: Use direct Postgres connection with pg library
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
          message: 'Migration executed successfully via direct database connection!' 
        });
      } catch (error: any) {
        // If pg is not installed, we'll handle it below
        if (error.code === 'MODULE_NOT_FOUND') {
          // pg not installed, continue to next method
        } else {
          throw error;
        }
      }
    }

    // Method 3: Create a helper function via Supabase client and call it
    // This requires the function to exist first, but we can try
    const supabase = createClient(supabaseUrl, supabaseServiceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    
    // Try calling a migration function if it exists
    let rpcError: any = null;
    try {
      const result = await supabase.rpc('add_position_column_to_contacts');
      rpcError = result.error;
    } catch {
      rpcError = { message: 'Function does not exist' };
    }
    
    if (!rpcError) {
      return NextResponse.json({ 
        success: true, 
        message: 'Migration executed successfully via RPC!' 
      });
    }

    // If all methods fail, return error with instructions
    return NextResponse.json({
      success: false,
      error: 'Could not execute migration programmatically',
      message: 'Please install pg library or add SUPABASE_SERVICE_ROLE_KEY',
      solutions: [
        'Install pg: npm install pg @types/pg',
        'Or add SUPABASE_SERVICE_ROLE_KEY to .env.local',
        'Or run SQL manually in Supabase SQL Editor'
      ],
      sql: sql
    }, { status: 400 });

  } catch (error: any) {
    console.error('Migration route error:', error);
    return NextResponse.json(
      { 
        error: error.message,
        sql: 'ALTER TABLE contacts ADD COLUMN IF NOT EXISTS position TEXT;'
      },
      { status: 500 }
    );
  }
}

