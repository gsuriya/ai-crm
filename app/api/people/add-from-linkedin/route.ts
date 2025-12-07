import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
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
    { message: 'Add from LinkedIn API endpoint is working', method: 'GET' },
    { headers: corsHeaders }
  );
}

/**
 * POST /api/people/add-from-linkedin
 * Adds a person from LinkedIn to the CRM
 * 1. Extracts profile data from LinkedIn
 * 2. Finds email with Hunter.io (NO domain guessing)
 * 3. Creates contact in database
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { linkedinUrl, profileData } = body;

    if (!linkedinUrl) {
      return NextResponse.json(
        { error: 'LinkedIn URL is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    console.log('[Add from LinkedIn] Starting process...');
    console.log('[Add from LinkedIn] Profile data:', profileData);

    // Step 1: Get company name
    const companyName = profileData?.company || '';
    if (!companyName) {
      return NextResponse.json(
        { error: 'Company name is required to find email' },
        { status: 400, headers: corsHeaders }
      );
    }

    console.log('[Add from LinkedIn] Company:', companyName);

    // Step 2: Find email with Hunter.io (they handle domain detection)
    console.log('[Add from LinkedIn] Finding email with Hunter.io...');
    const emailResult = await findEmail({
      firstName: profileData.firstName,
      lastName: profileData.lastName,
      company: companyName,
    });

    if (!emailResult || !emailResult.data || !emailResult.data.email) {
      return NextResponse.json(
        { error: `Could not find email for ${profileData.firstName} ${profileData.lastName} at ${companyName}. They may not be in Hunter.io's database.` },
        { status: 404, headers: corsHeaders }
      );
    }

    const email = emailResult.data.email;
    const emailScore = emailResult.data.score;
    console.log('[Add from LinkedIn] Found email:', email, 'Score:', emailScore);

    // Step 3: Find or create company
    let companyId: string | null = null;
    
    if (companyName) {
      // Check if company exists
      const { data: existingCompany } = await supabase
        .from('companies')
        .select('id')
        .eq('name', companyName)
        .single();
      
      if (existingCompany) {
        companyId = existingCompany.id;
        console.log('[Add from LinkedIn] Found existing company:', companyName, 'ID:', companyId);
      } else {
        // Create new company
        const { data: newCompany, error: companyError } = await supabase
          .from('companies')
          .insert({ name: companyName })
          .select()
          .single();
        
        if (companyError) {
          console.error('[Add from LinkedIn] Error creating company:', companyError);
        } else {
          companyId = newCompany.id;
          console.log('[Add from LinkedIn] Created new company:', companyName, 'ID:', companyId);
        }
      }
    }

    // Step 4: Check if contact already exists
    const { data: existingContact } = await supabase
      .from('contacts')
      .select('id')
      .eq('email', email)
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

    // Step 5: Create contact in database
    const contactData = {
      first_name: profileData.firstName || '',
      last_name: profileData.lastName || '',
      email: email,
      linkedin_url: linkedinUrl,
      job_title: profileData.title || '',
      current_company: companyName,
      profile_image_url: profileData.photoUrl || null,
      location: profileData.location || null,
    };

    console.log('[Add from LinkedIn] Creating contact:', contactData);

    const { data: newContact, error: insertError } = await supabase
      .from('contacts')
      .insert(contactData)
      .select()
      .single();

    if (insertError) {
      console.error('[Add from LinkedIn] Error creating contact:', insertError);
      throw insertError;
    }

    console.log('[Add from LinkedIn] Success! Contact ID:', newContact.id);

    return NextResponse.json({
      success: true,
      contact: {
        id: newContact.id,
        firstName: newContact.first_name,
        lastName: newContact.last_name,
        email: newContact.email,
        company: newContact.current_company,
        emailScore: emailScore,
      },
      message: `${newContact.first_name} ${newContact.last_name} added to your CRM!`,
    }, { headers: corsHeaders });
  } catch (error: any) {
    console.error('[Add from LinkedIn] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to add person to CRM' },
      { status: 500, headers: corsHeaders }
    );
  }
}
