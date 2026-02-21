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
 * GET /api/cadences/list
 * Returns all active cadences
 */
export async function GET(request: NextRequest) {
  try {
    const { data: cadences, error } = await supabase
      .from('cadences')
      .select('id, name, description, nodes, created_at, updated_at')
      .eq('is_active', true)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('[Cadences List] Error:', error);
      throw error;
    }

    return NextResponse.json(cadences || [], { headers: corsHeaders });
  } catch (error: any) {
    console.error('[Cadences List] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch cadences' },
      { status: 500, headers: corsHeaders }
    );
  }
}







