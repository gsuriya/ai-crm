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

// GET handler for testing/debugging
export async function GET(request: NextRequest) {
  return NextResponse.json(
    { message: 'Find Email API endpoint is working', method: 'GET' },
    { headers: corsHeaders }
  );
}

// Simple heuristic to convert company name to domain
// Hunter.io will handle the actual domain validation and email finding
function companyToDomain(companyName: string): string {
  const cleaned = companyName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '') // Remove special chars
    .replace(/\s+/g, '') // Remove spaces
    .replace(/inc|llc|ltd|corp|corporation|company|co|ventures|capital|partners/g, ''); // Remove common suffixes
  
  return `${cleaned}.com`;
}

/**
 * POST /api/people/find-email
 * Finds email for a person using Hunter.io (without adding to CRM)
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

    const domain = companyToDomain(company);
    console.log('[Find Email] Finding email for:', firstName, lastName, 'at', company, '→', domain);

    const emailResult = await findEmail({
      firstName,
      lastName,
      domain,
      company,
    });

    if (!emailResult || !emailResult.data || !emailResult.data.email) {
      return NextResponse.json(
        { error: 'Could not find email' },
        { status: 404, headers: corsHeaders }
      );
    }

    console.log('[Find Email] Found:', emailResult.data.email, 'Score:', emailResult.data.score);

    return NextResponse.json({
      email: emailResult.data.email,
      score: emailResult.data.score,
    }, { headers: corsHeaders });

  } catch (error: any) {
    console.error('[Find Email] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to find email' },
      { status: 500, headers: corsHeaders }
    );
  }
}
