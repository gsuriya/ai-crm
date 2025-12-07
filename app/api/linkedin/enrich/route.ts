import { NextRequest, NextResponse } from 'next/server';
import { enrichPersonByLinkedIn } from '@/lib/services/apollo';

export const dynamic = 'force-dynamic';

/**
 * POST /api/linkedin/enrich
 * Enriches a LinkedIn profile with email and company data using Apollo.io
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { linkedinUrl, profileData } = body;

    if (!linkedinUrl) {
      return NextResponse.json(
        { error: 'LinkedIn URL is required' },
        { status: 400 }
      );
    }

    console.log('[LinkedIn Enrich] Enriching profile:', linkedinUrl);
    console.log('[LinkedIn Enrich] Additional data:', profileData);

    // Use Apollo.io to enrich the profile
    // Pass additional profile data to improve matching accuracy
    const enrichedData = await enrichPersonByLinkedIn(linkedinUrl, {
      firstName: profileData?.firstName,
      lastName: profileData?.lastName,
      name: profileData?.name,
      organizationName: profileData?.company,
      title: profileData?.title,
    });

    if (!enrichedData || !enrichedData.person) {
      return NextResponse.json(
        { error: 'Could not enrich profile. Person not found in Apollo database.' },
        { status: 404 }
      );
    }

    const person = enrichedData.person;

    // Extract relevant data
    const result = {
      firstName: person.first_name,
      lastName: person.last_name,
      fullName: person.name,
      email: person.email,
      emailStatus: person.email_status,
      title: person.title,
      linkedinUrl: person.linkedin_url,
      photoUrl: person.photo_url,
      company: person.organization ? {
        name: person.organization.name,
        website: person.organization.website_url,
        domain: person.organization.primary_domain,
        linkedinUrl: person.organization.linkedin_url,
        logoUrl: person.organization.logo_url,
        phone: person.organization.phone || person.organization.primary_phone?.number,
      } : null,
    };

    console.log('[LinkedIn Enrich] Success:', result);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('[LinkedIn Enrich] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to enrich LinkedIn profile' },
      { status: 500 }
    );
  }
}
