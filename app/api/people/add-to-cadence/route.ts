import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabase } from '@/lib/supabase';
import { sendEmail } from '@/lib/services/gmail-direct';
import { checkPlanLimits, incrementPeopleAdded } from '@/lib/services/plan-limits';

export async function POST(request: NextRequest) {
  try {
    const { email, firstName, lastName, company, cadenceId, emailSubject, emailBody } = await request.json();

    if (!email || !firstName || !lastName || !company || !cadenceId || !emailSubject || !emailBody) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get current user using cookie-based auth
    const cookieStore = await cookies();
    const authClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
        },
      }
    );

    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Check plan limits
    const planStatus = await checkPlanLimits(supabase, user.id);
    if (!planStatus.canAddMore) {
      return NextResponse.json({ 
        error: `You've reached the free plan limit of ${planStatus.limit} people. Please upgrade to add more.`,
        limitReached: true,
        peopleAdded: planStatus.peopleAdded,
        limit: planStatus.limit
      }, { status: 403 });
    }

    // Get the cadence to find the blocks
    const { data: cadence } = await supabase
      .from('cadences')
      .select('*')
      .eq('id', cadenceId)
      .single();

    if (!cadence || !cadence.nodes) {
      return NextResponse.json({ error: 'Cadence not found' }, { status: 404 });
    }

    // Find the trigger/start block
    const startNode = cadence.nodes.find((n: any) => n.type === 'trigger' || n.type === 'start');
    if (!startNode) {
      return NextResponse.json({ error: 'Invalid cadence structure - no trigger' }, { status: 400 });
    }

    // Find the first email block (connected from trigger)
    const firstEmailNode = cadence.nodes.find((n: any) => 
      n.type === 'email' && startNode.connections?.includes(n.id)
    );
    
    if (!firstEmailNode) {
      return NextResponse.json({ error: 'No email block found in cadence' }, { status: 400 });
    }

    // 1. Find or create company
    let companyRecord;
    const { data: existingCompany } = await supabase
      .from('companies')
      .select('*')
      .ilike('name', company)
      .single();

    if (existingCompany) {
      companyRecord = existingCompany;
    } else {
      const { data: newCompany, error: companyError } = await supabase
        .from('companies')
        .insert({ name: company })
        .select()
        .single();

      if (companyError) throw companyError;
      companyRecord = newCompany;
    }

    // 2. Find or create contact
    let contactRecord;
    const { data: existingContact } = await supabase
      .from('contacts')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    if (existingContact) {
      contactRecord = existingContact;
      await supabase
        .from('contacts')
        .update({
          first_name: firstName,
          last_name: lastName,
          company_id: companyRecord.id,
        })
        .eq('id', existingContact.id);
    } else {
      const { data: newContact, error: contactError } = await supabase
        .from('contacts')
        .insert({
          email: email.toLowerCase(),
          first_name: firstName,
          last_name: lastName,
          company_id: companyRecord.id,
          
        })
        .select()
        .single();

      if (contactError) throw contactError;
      contactRecord = newContact;
    }

    // 3. Send the email immediately
    console.log('[Add to Cadence] Sending first email to:', email);
    const emailResult = await sendEmail(user.id, {
      to: email,
      subject: emailSubject,
      body: emailBody,
    });

    console.log('[Add to Cadence] Email sent:', emailResult);

    // 4. Create company_cadence entry
    const { data: companyCadence, error: cadenceError } = await supabase
      .from('company_cadences')
      .insert({
        company_id: companyRecord.id,
        contact_id: contactRecord.id,
        cadence_id: cadenceId,
        status: 'active',
        current_node_id: firstEmailNode.id,
      })
      .select()
      .single();

    if (cadenceError) throw cadenceError;

    // 5. Find the next block after the first email
    const nextBlockId = firstEmailNode.connections?.[0] || null;
    const nextBlock = nextBlockId ? cadence.nodes.find((n: any) => n.id === nextBlockId) : null;

    // Calculate scheduled_for based on next block
    let scheduledFor = null;
    let actualNextBlockId = nextBlockId;

    if (nextBlock?.type === 'delay') {
      const delayConfig = nextBlock.config || {};
      const delayMs = 
        (delayConfig.delayDays || 0) * 24 * 60 * 60 * 1000 +
        (delayConfig.delayHours || 0) * 60 * 60 * 1000 +
        (delayConfig.delayMinutes || 0) * 60 * 1000 +
        (delayConfig.delaySeconds || 0) * 1000;
      scheduledFor = new Date(Date.now() + delayMs).toISOString();
      // Move to the block after the delay
      actualNextBlockId = nextBlock.connections?.[0] || nextBlockId;
    }

    // 6. Create cadence_execution with first email already completed
    const executedBlockIds = [startNode.id, firstEmailNode.id];
    if (nextBlock?.type === 'delay') {
      executedBlockIds.push(nextBlockId);
    }

    const { data: execution, error: execError } = await supabase
      .from('cadence_executions')
      .insert({
        company_cadence_id: companyCadence.id,
        current_block_id: actualNextBlockId || firstEmailNode.id,
        status: actualNextBlockId ? 'active' : 'completed',
        scheduled_for: scheduledFor,
        metadata: {
          company_id: companyRecord.id,
          cadence_id: cadenceId,
          user_id: user.id,
          blocks: cadence.nodes,
          threadInfoMap: {
            [firstEmailNode.id]: {
              threadId: emailResult.threadId,
              messageId: emailResult.messageId,
              gmailMessageId: emailResult.gmailMessageId,
            }
          },
          executedBlockIds: executedBlockIds,
          manualFirstEmail: true,
          manualFirstEmailData: {
            subject: emailSubject,
            body: emailBody,
            sentAt: new Date().toISOString(),
          }
        },
      })
      .select()
      .single();

    if (execError) throw execError;

    // 7. Increment people_added_count for billing
    await incrementPeopleAdded(supabase, user.id);

    return NextResponse.json({
      success: true,
      contact: contactRecord,
      company: companyRecord,
      companyCadence: companyCadence,
      execution: execution,
      emailSent: true,
    });
  } catch (error: any) {
    console.error('Error adding to cadence:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
