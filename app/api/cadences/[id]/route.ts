import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// CORS headers for Chrome extension
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Handle OPTIONS request for CORS preflight
export async function OPTIONS(request: NextRequest) {
  return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * GET /api/cadences/[id]
 * Returns a single cadence with all its details including blocks
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const { data: cadence, error } = await supabase
      .from('cadences')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('[Cadence Detail] Error:', error);
      throw error;
    }

    if (!cadence) {
      return NextResponse.json(
        { error: 'Cadence not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    return NextResponse.json(cadence, { headers: corsHeaders });
  } catch (error: any) {
    console.error('[Cadence Detail] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch cadence' },
      { status: 500, headers: corsHeaders }
    );
  }
}
