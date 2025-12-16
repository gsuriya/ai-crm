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
 * POST /api/people/add-from-linkedin-with-email
 * Adds a person from LinkedIn to the CRM with a manually provided email
 * Used when Hunter.io can't find the email
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { linkedinUrl, profileData, email } = body;

    if (!linkedinUrl) {
      return NextResponse.json(
        { error: 'LinkedIn URL is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Valid email is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    console.log('[Add from LinkedIn with Email] Starting process...');
    console.log('[Add from LinkedIn with Email] Email:', email);
    console.log('[Add from LinkedIn with Email] Profile data:', profileData);

    const companyName = profileData?.company || '';

    // Find or create company
    let companyId: string | null = null;
    
    if (companyName) {
      // Check if company exists (case-insensitive)
      const { data: existingCompany } = await supabase
        .from('companies')
        .select('id')
        .ilike('name', companyName)
        .single();
      
      if (existingCompany) {
        companyId = existingCompany.id;
        console.log('[Add from LinkedIn with Email] Found existing company:', companyName, 'ID:', companyId);
      } else {
        // Create new company
        const { data: newCompany, error: companyError } = await supabase
          .from('companies')
          .insert({ name: companyName })
          .select()
          .single();
        
        if (companyError) {
          console.error('[Add from LinkedIn with Email] Error creating company:', companyError);
        } else {
          companyId = newCompany.id;
          console.log('[Add from LinkedIn with Email] Created new company:', companyName, 'ID:', companyId);
        }
      }
    }

    // Check if contact already exists
    const { data: existingContact } = await supabase
      .from('contacts')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    if (existingContact) {
      return NextResponse.json(
        { 
          error: `${profileData.firstName} ${profileData.lastName} is already in your CRM!`,
          contact: { id: existingContact.id }
        },
        { status: 409, headers: corsHeaders }
      );
    }

    // Create contact in database
    const contactData = {
      first_name: profileData.firstName || '',
      last_name: profileData.lastName || '',
      email: email.toLowerCase(),
      company_id: companyId,
      linkedin_url: linkedinUrl,
      job_title: profileData.title || '',
      current_company: companyName,
      profile_image_url: profileData.photoUrl || null,
      location: profileData.location || null,
    };

    console.log('[Add from LinkedIn with Email] Creating contact:', contactData);

    const { data: newContact, error: insertError } = await supabase
      .from('contacts')
      .insert(contactData)
      .select()
      .single();

    if (insertError) {
      console.error('[Add from LinkedIn with Email] Error creating contact:', insertError);
      throw insertError;
    }

    console.log('[Add from LinkedIn with Email] Success! Contact ID:', newContact.id);

    return NextResponse.json({
      success: true,
      contact: {
        id: newContact.id,
        firstName: newContact.first_name,
        lastName: newContact.last_name,
        email: newContact.email,
        company: newContact.current_company,
        manualEmail: true,
      },
      message: `${newContact.first_name} ${newContact.last_name} added to your CRM!`,
    }, { headers: corsHeaders });
  } catch (error: any) {
    console.error('[Add from LinkedIn with Email] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to add person to CRM' },
      { status: 500, headers: corsHeaders }
    );
  }
}


