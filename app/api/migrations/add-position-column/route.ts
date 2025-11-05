import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Run the migration SQL
    const { error } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE contacts ADD COLUMN IF NOT EXISTS position TEXT;'
    });

    if (error) {
      // If RPC doesn't exist, try direct query via Supabase client
      // Note: Supabase client doesn't support raw SQL directly
      // So we'll need to use a different approach
      
      // Actually, let's just return the SQL for manual execution
      return NextResponse.json({
        success: false,
        message: 'Please run this SQL manually in Supabase SQL Editor',
        sql: 'ALTER TABLE contacts ADD COLUMN IF NOT EXISTS position TEXT;',
        instructions: [
          '1. Go to your Supabase dashboard',
          '2. Navigate to SQL Editor',
          '3. Run the SQL shown above',
        ]
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Position column added successfully'
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to run migration' },
      { status: 500 }
    );
  }
}


