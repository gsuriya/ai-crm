import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendEmail } from '@/lib/services/gmail-simple';
import { getExecution, executeNextBlock } from '@/lib/services/cadence-execution';

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

      // Import and use the findEmail function (NO domain guessing)
      const { findEmail } = await import('@/lib/services/hunter');
      
      const emailResult = await findEmail({
        firstName: profileData.firstName,
        lastName: profileData.lastName,
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

    // Step 5: Send the custom email and capture thread info
    let emailThreadInfo: { threadId: string; messageId: string } | null = null;
    let userIdForExecution: string | null = null;
    
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
            const emailResult = await sendEmail(session.user_id, {
              to: contact.email,
              subject: customEmail.subject,
              body: customEmail.body,
            });
            console.log('[Add to Cadence] Email sent successfully!');
            console.log('[Add to Cadence] Thread ID:', emailResult.threadId);
            console.log('[Add to Cadence] Message ID:', emailResult.messageId);
            
            // Store thread info for cadence execution
            emailThreadInfo = {
              threadId: emailResult.threadId,
              messageId: emailResult.messageId,
            };
            userIdForExecution = session.user_id;
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

    // Step 6: Find or create cadence execution and continue workflow
    const blocks = cadence.nodes || [];
    const triggerBlock = blocks.find((b: any) => b.type === 'trigger');
    const firstEmailBlock = blocks.find((b: any) => b.type === 'email');
    
    if (!triggerBlock || !firstEmailBlock) {
      return NextResponse.json(
        { error: 'Cadence must have a trigger and at least one email block' },
        { status: 400, headers: corsHeaders }
      );
    }
    
    // Delete any existing executions for this company_cadence (start fresh)
    await supabase
      .from('cadence_executions')
      .delete()
      .eq('company_cadence_id', companyCadence.id);
    
    console.log('[Add to Cadence] Cleaned up old executions, creating new one...');
    
    // Create new execution with thread info if email was sent
    const threadInfoMap: Record<string, { threadId: string; messageId: string }> = {};
    const executedBlockIds: string[] = [triggerBlock.id]; // Trigger is always executed first
    
    // If we sent an email, store its thread info
    if (emailThreadInfo && firstEmailBlock) {
      threadInfoMap[firstEmailBlock.id] = emailThreadInfo;
      executedBlockIds.push(firstEmailBlock.id);
      console.log('[Add to Cadence] Storing thread info for first email block:', firstEmailBlock.id);
    }
    
    // Find the next block after the first email (wait block)
    const nextBlockAfterEmail = firstEmailBlock.connections && firstEmailBlock.connections.length > 0
      ? firstEmailBlock.connections[0]
      : null;
    
    console.log('[Add to Cadence] Next block after first email:', nextBlockAfterEmail);
    
    const { data: execution, error: execError } = await supabase
      .from('cadence_executions')
      .insert({
        company_cadence_id: companyCadence.id,
        current_block_id: nextBlockAfterEmail || firstEmailBlock.id, // Start at next block (wait) or first email if no next block
        status: 'active',
        metadata: {
          company_id: companyId,
          cadence_id: cadenceId,
          contact_id: contact.id,
          user_id: userIdForExecution, // Store user_id for future email sends
          blocks: blocks,
          threadInfoMap: threadInfoMap,
          executedBlockIds: executedBlockIds,
        },
      })
      .select()
      .single();

    if (execError) {
      console.error('[Add to Cadence] Error creating execution:', execError);
      return NextResponse.json(
        { error: 'Failed to create execution: ' + execError.message },
        { status: 500, headers: corsHeaders }
      );
    }
    
    console.log('[Add to Cadence] Created execution:', execution.id);
    console.log('[Add to Cadence] Current block ID:', execution.current_block_id);
    
    // Step 7: Continue workflow execution (process wait block and schedule next email)
    if (emailThreadInfo && userIdForExecution) {
      console.log('[Add to Cadence] Continuing workflow execution...');
      console.log('[Add to Cadence] Execution ID:', execution.id);
      console.log('[Add to Cadence] Current block ID:', execution.current_block_id);
      console.log('[Add to Cadence] Blocks:', blocks.map((b: any) => `${b.id}: ${b.type} - ${b.title || ''}`));
      
      try {
        // Get the full execution with metadata
        const fullExecution = await getExecution(supabase, execution.id);
        if (!fullExecution) {
          throw new Error('Failed to fetch execution');
        }
        
        console.log('[Add to Cadence] Full execution fetched, current_block_id:', fullExecution.current_block_id);
        const currentBlock = blocks.find((b: any) => b.id === fullExecution.current_block_id);
        console.log('[Add to Cadence] Current block:', currentBlock ? `${currentBlock.type} - ${currentBlock.title || currentBlock.id}` : 'NOT FOUND');
        
        // Execute the workflow - this will process the wait block and schedule the next email
        // The current_block_id should already be pointing to the wait block (next after first email)
        console.log('[Add to Cadence] Calling executeNextBlock...');
        await executeNextBlock(supabase, fullExecution, blocks, { skipRecursion: false });
        console.log('[Add to Cadence] ✅ Workflow execution continued successfully');
        
        // Check the execution status after
        const updatedExecution = await getExecution(supabase, execution.id);
        if (updatedExecution) {
          console.log('[Add to Cadence] Execution after workflow:');
          console.log('[Add to Cadence]   Status:', updatedExecution.status);
          console.log('[Add to Cadence]   Current block ID:', updatedExecution.current_block_id);
          if (updatedExecution.scheduled_for) {
            console.log('[Add to Cadence]   Scheduled for:', new Date(updatedExecution.scheduled_for).toLocaleString());
          }
        }
      } catch (execError: any) {
        console.error('[Add to Cadence] ❌ Error continuing workflow:', execError);
        console.error('[Add to Cadence] Error stack:', execError.stack);
        // Don't fail the whole request - email was sent successfully
      }
    } else {
      console.log('[Add to Cadence] ⚠️ Skipping workflow execution - emailThreadInfo:', !!emailThreadInfo, 'userIdForExecution:', !!userIdForExecution);
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
