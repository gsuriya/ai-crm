import { NextRequest, NextResponse } from 'next/server';
import { findEmail } from '@/lib/services/hunter';

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
 * POST /api/people/find-email
 * Finds an email address using Hunter.io
 * Does NOT add to CRM - just returns the email
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { firstName, lastName, company } = body;

    if (!firstName || !lastName || !company) {
      return NextResponse.json(
        { error: 'firstName, lastName, and company are required' },
        { status: 400, headers: corsHeaders }
      );
    }

    console.log('[Find Email] Searching for:', { firstName, lastName, company });

    // Use Hunter.io to find the email
    const result = await findEmail({
      firstName,
      lastName,
      company,
    });

    if (!result || !result.data || !result.data.email) {
      return NextResponse.json(
        { 
          error: `Could not find email for ${firstName} ${lastName} at ${company}`,
          details: 'This person may not be in Hunter.io\'s database. Try entering the email manually.',
        },
        { status: 404, headers: corsHeaders }
      );
    }

    console.log('[Find Email] Found:', {
      email: result.data.email,
      score: result.data.score,
    });

    return NextResponse.json({
      success: true,
      email: result.data.email,
      score: result.data.score,
      firstName: result.data.first_name,
      lastName: result.data.last_name,
      position: result.data.position,
      company: result.data.company,
      sources: result.data.sources?.length || 0,
    }, { headers: corsHeaders });

  } catch (error: any) {
    console.error('[Find Email] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to find email' },
      { status: 500, headers: corsHeaders }
    );
  }
}
