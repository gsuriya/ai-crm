import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

/**
 * Associate a company with a cadence (doesn't execute yet)
 * Returns the company_cadence_id
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { company_id, cadence_id } = body;

    if (!company_id || !cadence_id) {
      return NextResponse.json(
        { error: 'company_id and cadence_id are required' },
        { status: 400 }
      );
    }

    // Create Supabase client with server-side auth (reads from cookies)
    const supabase = await createServerSupabaseClient();

    // Get current user - this reads from cookies automatically
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      // Log available cookies for debugging
      const cookieStore = await import('next/headers').then(m => m.cookies());
      const allCookies = cookieStore.getAll();
      const cookieNames = allCookies.map(c => c.name);
      console.error('Auth error:', authError?.message);
      console.error('Available cookies:', cookieNames);
      
      return NextResponse.json(
        { 
          error: 'Unauthorized - please sign in',
          details: authError?.message || 'No user session found',
          debug: {
            cookiesFound: cookieNames.length,
            cookieNames: cookieNames.slice(0, 10), // First 10 cookies
          }
        },
        { status: 401 }
      );
    }

    // Verify cadence exists (all cadences are shared company-wide)
    const { data: cadence, error: cadenceError } = await supabase
      .from('cadences')
      .select('*')
      .eq('id', cadence_id)
      .single();

    if (cadenceError || !cadence) {
      return NextResponse.json(
        { error: 'Cadence not found' },
        { status: 404 }
      );
    }

    // Check if company_cadence already exists
    const { data: existing } = await supabase
      .from('company_cadences')
      .select('id')
      .eq('company_id', company_id)
      .eq('cadence_id', cadence_id)
      .single();

    if (existing) {
      return NextResponse.json({
        success: true,
        company_cadence_id: existing.id,
        message: 'Company already associated with this cadence',
      });
    }

    // Create association (but don't execute yet)
    const { data: companyCadence, error: insertError } = await supabase
      .from('company_cadences')
      .insert({
        company_id,
        cadence_id,
        status: 'paused', // Use 'paused' instead of 'pending' to match schema constraint
        start_date: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating company_cadence:', insertError);
      console.error('Insert error details:', JSON.stringify(insertError, null, 2));
      return NextResponse.json(
        { error: 'Failed to associate company with cadence', details: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      company_cadence_id: companyCadence.id,
      message: 'Company associated with cadence. Use "Start Cadence" to execute.',
    });
  } catch (error: any) {
    console.error('Error associating company with cadence:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to associate company with cadence' },
      { status: 500 }
    );
  }
}
