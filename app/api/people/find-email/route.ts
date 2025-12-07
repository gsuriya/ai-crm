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

// Company name to domain mapping
const COMPANY_DOMAIN_MAP: Record<string, string> = {
  'google': 'google.com',
  'meta': 'meta.com',
  'facebook': 'meta.com',
  'apple': 'apple.com',
  'microsoft': 'microsoft.com',
  'amazon': 'amazon.com',
  'moelis': 'moelis.com',
  'moelis & company': 'moelis.com',
  'goldman sachs': 'gs.com',
  'morgan stanley': 'morganstanley.com',
  'jpmorgan': 'jpmorganchase.com',
  'jp morgan': 'jpmorganchase.com',
  'bank of america': 'bofa.com',
  'citigroup': 'citi.com',
  'wells fargo': 'wellsfargo.com',
  'stripe': 'stripe.com',
  'nyu': 'nyu.edu',
  'nyu stern': 'stern.nyu.edu',
  'insight partners': 'insightpartners.com',
  'herbalife': 'herbalife.com',
};

function companyToDomain(companyName: string): string {
  const cleaned = companyName.toLowerCase().trim();
  
  for (const [key, domain] of Object.entries(COMPANY_DOMAIN_MAP)) {
    if (cleaned.includes(key)) {
      return domain;
    }
  }
  
  const domainName = cleaned
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '')
    .replace(/inc|llc|ltd|corp|corporation|company|co/g, '');
  
  return `${domainName}.com`;
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
