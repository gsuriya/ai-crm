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
 * GET /api/contacts/[id]
 * Returns a single contact by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const { data: contact, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('[Contact Detail] Error:', error);
      throw error;
    }

    if (!contact) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    return NextResponse.json(contact, { headers: corsHeaders });
  } catch (error: any) {
    console.error('[Contact Detail] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch contact' },
      { status: 500, headers: corsHeaders }
    );
  }
}
