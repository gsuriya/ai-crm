import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendEmail } from '@/lib/services/gmail-simple';

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
 * POST /api/linkedin/add-to-cadence
 * Adds a LinkedIn profile to a cadence and sends the first email
 * 1. Gets contact from database (should already exist from add-from-linkedin)
 * 2. Adds contact to specified cadence
 * 3. Sends the custom email provided
 * 4. Starts cadence execution
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { linkedinUrl, cadenceId, profileData, customEmail } = body;

    if (!linkedinUrl || !cadenceId) {
      return NextResponse.json(
        { error: 'LinkedIn URL and cadence ID are required' },
        { status: 400, headers: corsHeaders }
      );
    }

    console.log('[Add to Cadence] Starting process...');
    console.log('[Add to Cadence] LinkedIn URL:', linkedinUrl);
    console.log('[Add to Cadence] Cadence ID:', cadenceId);
    console.log('[Add to Cadence] Custom email:', customEmail);

    // Step 1: Find or create contact
    let contact: any = null;
    
    // Try to find existing contact
    const { data: existingContact } = await supabase
      .from('contacts')
      .select('*')
      .eq('linkedin_url', linkedinUrl)
      .single();

    if (existingContact) {
      contact = existingContact;
      console.log('[Add to Cadence] Found existing contact:', contact.email);
    } else {
      // Contact doesn't exist - create it now
      console.log('[Add to Cadence] Contact not found, creating new contact...');
      
      // We need to find the email first
      if (!profileData || !profileData.firstName || !profileData.lastName || !profileData.company) {
        return NextResponse.json(
          { error: 'Missing profile data to create contact' },
          { status: 400, headers: corsHeaders }
        );
      }

      // Import and use the findEmail function
      const { findEmail } = await import('@/lib/services/hunter');
      const companyToDomain = (companyName: string): string => {
        const COMPANY_DOMAIN_MAP: Record<string, string> = {
          'google': 'google.com', 'meta': 'meta.com', 'facebook': 'meta.com',
          'apple': 'apple.com', 'microsoft': 'microsoft.com', 'amazon': 'amazon.com',
          'moelis': 'moelis.com', 'moelis & company': 'moelis.com',
          'goldman sachs': 'gs.com', 'morgan stanley': 'morganstanley.com',
          'insight partners': 'insightpartners.com', 'herbalife': 'herbalife.com',
        };
        
        const cleaned = companyName.toLowerCase().trim();
        for (const [key, domain] of Object.entries(COMPANY_DOMAIN_MAP)) {
          if (cleaned.includes(key)) return domain;
        }
        
        const domainName = cleaned
          .replace(/[^a-z0-9\s]/g, '')
          .replace(/\s+/g, '')
          .replace(/inc|llc|ltd|corp|corporation|company|co/g, '');
        
        return `${domainName}.com`;
      };

      const domain = companyToDomain(profileData.company);
      const emailResult = await findEmail({
        firstName: profileData.firstName,
        lastName: profileData.lastName,
        domain: domain,
        company: profileData.company,
      });

      if (!emailResult || !emailResult.data || !emailResult.data.email) {
        return NextResponse.json(
          { error: 'Could not find email for this person' },
          { status: 404, headers: corsHeaders }
        );
      }

      const email = emailResult.data.email;
      
      // Create the contact
      const { data: newContact, error: createError } = await supabase
        .from('contacts')
        .insert({
          first_name: profileData.firstName,
          last_name: profileData.lastName,
          email: email,
          linkedin_url: linkedinUrl,
          job_title: profileData.title || '',
          current_company: profileData.company,
          profile_image_url: profileData.photoUrl || null,
          location: profileData.location || null,
        })
        .select()
        .single();

      if (createError) {
        return NextResponse.json(
          { error: 'Failed to create contact: ' + createError.message },
          { status: 500, headers: corsHeaders }
        );
      }

      contact = newContact;
      console.log('[Add to Cadence] Created new contact:', contact.email);
    }

    // Step 2: Get cadence details
    const { data: cadence, error: cadenceError } = await supabase
      .from('cadences')
      .select('*')
      .eq('id', cadenceId)
      .single();

    if (cadenceError || !cadence) {
      return NextResponse.json(
        { error: 'Cadence not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    // Step 3: Find or create company
    let companyId: string | null = null;
    if (contact.current_company) {
      const { data: existingCompany } = await supabase
        .from('companies')
        .select('id')
        .eq('name', contact.current_company)
        .single();
      
      if (existingCompany) {
        companyId = existingCompany.id;
      } else {
        const { data: newCompany } = await supabase
          .from('companies')
          .insert({ name: contact.current_company })
          .select()
          .single();
        
        if (newCompany) {
          companyId = newCompany.id;
        }
      }
    }

    // Step 4: Find or create company_cadence entry
    let companyCadence: any = null;
    
    // Check if company_cadence already exists
    const { data: existingCC } = await supabase
      .from('company_cadences')
      .select('*')
      .eq('company_id', companyId)
      .eq('cadence_id', cadenceId)
      .single();

    if (existingCC) {
      // Already exists - update contact_id if needed and use existing
      companyCadence = existingCC;
      if (existingCC.contact_id !== contact.id) {
        await supabase
          .from('company_cadences')
          .update({ contact_id: contact.id, status: 'active' })
          .eq('id', existingCC.id);
        companyCadence.contact_id = contact.id;
      }
      console.log('[Add to Cadence] Found existing company_cadence:', companyCadence.id);
    } else {
      // Create new company_cadence
      const { data: newCC, error: ccError } = await supabase
        .from('company_cadences')
        .insert({
          company_id: companyId,
          contact_id: contact.id,
          cadence_id: cadenceId,
          status: 'active',
        })
        .select()
        .single();

      if (ccError) {
        console.error('[Add to Cadence] Error creating company_cadence:', ccError);
        return NextResponse.json(
          { error: 'Failed to add to cadence: ' + ccError.message },
          { status: 500, headers: corsHeaders }
        );
      }

      companyCadence = newCC;
      console.log('[Add to Cadence] Created company_cadence:', companyCadence.id);
    }

    // Step 5: Send the custom email
    if (customEmail && customEmail.subject && customEmail.body) {
      console.log('[Add to Cadence] Sending email to:', contact.email);
      
      try {
        // Get all user sessions and try to find one with valid tokens
        const { data: sessions, error: sessionsError } = await supabase
          .from('user_sessions')
          .select('user_id, refresh_token, access_token')
          .order('updated_at', { ascending: false });

        if (sessionsError || !sessions || sessions.length === 0) {
          throw new Error('No authenticated user found. Please sign in to your CRM at http://localhost:3000');
        }

        console.log(`[Add to Cadence] Found ${sessions.length} user session(s), trying to send email...`);

        // Try each session until one works
        let emailSent = false;
        let lastError: any = null;

        for (const session of sessions) {
          try {
            console.log(`[Add to Cadence] Attempting to send with user_id: ${session.user_id}`);
            await sendEmail(session.user_id, {
              to: contact.email,
              subject: customEmail.subject,
              body: customEmail.body,
            });
            console.log('[Add to Cadence] Email sent successfully!');
            emailSent = true;
            break;
          } catch (err: any) {
            console.error(`[Add to Cadence] Failed with user ${session.user_id}:`, err.message);
            lastError = err;
            continue; // Try next session
          }
        }

        if (!emailSent) {
          throw new Error(
            `Failed to send email with any user session. ` +
            `Last error: ${lastError?.message || 'Unknown error'}. ` +
            `Please sign out and sign back in at http://localhost:3000 to refresh your Google tokens.`
          );
        }
      } catch (emailError: any) {
        console.error('[Add to Cadence] Error sending email:', emailError);
        return NextResponse.json(
          { error: 'Failed to send email: ' + emailError.message },
          { status: 500, headers: corsHeaders }
        );
      }
    }

    // Step 6: Find or create cadence execution
    const blocks = cadence.nodes || [];
    const firstEmailBlock = blocks.find((b: any) => b.type === 'email');
    
    // Check if execution already exists
    const { data: existingExecution } = await supabase
      .from('cadence_executions')
      .select('*')
      .eq('company_cadence_id', companyCadence.id)
      .single();

    if (!existingExecution) {
      // Create new execution
      const { data: execution, error: execError } = await supabase
        .from('cadence_executions')
        .insert({
          company_cadence_id: companyCadence.id,
          current_block_id: firstEmailBlock?.id || blocks[0]?.id,
          status: 'active',
          metadata: {
            company_id: companyId,
            cadence_id: cadenceId,
            contact_id: contact.id,
            blocks: blocks,
            executedBlockIds: firstEmailBlock ? [firstEmailBlock.id] : [],
          },
        })
        .select()
        .single();

      if (execError) {
        console.error('[Add to Cadence] Error creating execution:', execError);
      } else {
        console.log('[Add to Cadence] Created execution:', execution.id);
      }
    } else {
      console.log('[Add to Cadence] Execution already exists:', existingExecution.id);
    }

    console.log('[Add to Cadence] Success!');

    return NextResponse.json({
      success: true,
      contact: {
        id: contact.id,
        firstName: contact.first_name,
        lastName: contact.last_name,
        email: contact.email,
      },
      companyCadence: {
        id: companyCadence.id,
      },
      message: `${contact.first_name} ${contact.last_name} added to cadence!`,
    }, { headers: corsHeaders });

  } catch (error: any) {
    console.error('[Add to Cadence] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to add to cadence' },
      { status: 500, headers: corsHeaders }
    );
  }
}
