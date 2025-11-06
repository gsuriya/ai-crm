import { FlowBlock } from '@/components/cadence-flow-builder';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface CadenceExecution {
  id: string;
  company_cadence_id: string;
  current_block_id: string;
  status: 'active' | 'paused' | 'completed' | 'error';
  scheduled_for?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

/**
 * Start workflow execution for a company
 */
export async function startWorkflowExecution(
  supabase: SupabaseClient,
  companyId: string,
  cadenceId: string,
  blocks: FlowBlock[]
): Promise<{ companyCadenceId: string; executionId: string }> {
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  // Find trigger block
  const triggerBlock = blocks.find(b => b.type === 'trigger');
  if (!triggerBlock) {
    throw new Error('No trigger block found in cadence');
  }

  // Create or get company_cadence entry
  const { data: companyCadence, error: ccError } = await supabase
    .from('company_cadences')
    .upsert({
      company_id: companyId,
      cadence_id: cadenceId,
      status: 'active',
      start_date: new Date().toISOString(),
      current_node_id: triggerBlock.id,
    }, {
      onConflict: 'company_id,cadence_id',
    })
    .select()
    .single();

  if (ccError || !companyCadence) {
    throw new Error(`Failed to create company_cadence: ${ccError?.message}`);
  }

  // Create cadence_execution entry
  const { data: execution, error: execError } = await supabase
    .from('cadence_executions')
    .insert({
      company_cadence_id: companyCadence.id,
      current_block_id: triggerBlock.id,
      status: 'active',
      metadata: {
        company_id: companyId,
        cadence_id: cadenceId,
        user_id: user.id, // Store user_id so we can use it after delays
        blocks: blocks,
        threadInfoMap: {}, // CRITICAL: Start with empty threadInfoMap for each new execution
        executedBlockIds: [], // CRITICAL: Track execution order - which blocks were executed in THIS execution
      },
    })
    .select()
    .single();

  if (execError || !execution) {
    throw new Error(`Failed to create cadence_execution: ${execError?.message}`);
  }

  return {
    companyCadenceId: companyCadence.id,
    executionId: execution.id,
  };
}

/**
 * Update execution state
 */
export async function updateExecutionState(
  supabase: SupabaseClient,
  executionId: string,
  updates: {
    current_block_id?: string;
    status?: 'active' | 'paused' | 'completed' | 'error';
    scheduled_for?: Date | null;
    metadata?: Record<string, any>;
  }
): Promise<void> {
  const updateData: any = {};
  
  if (updates.current_block_id !== undefined) {
    updateData.current_block_id = updates.current_block_id;
  }
  if (updates.status !== undefined) {
    updateData.status = updates.status;
  }
  if (updates.scheduled_for !== undefined) {
    updateData.scheduled_for = updates.scheduled_for ? updates.scheduled_for.toISOString() : null;
  }
  if (updates.metadata !== undefined) {
    updateData.metadata = updates.metadata;
  }

  const { error } = await supabase
    .from('cadence_executions')
    .update(updateData)
    .eq('id', executionId);

  if (error) {
    throw new Error(`Failed to update execution: ${error.message}`);
  }
}

/**
 * Get execution by ID
 */
export async function getExecution(supabase: SupabaseClient, executionId: string): Promise<CadenceExecution | null> {
  const { data, error } = await supabase
    .from('cadence_executions')
    .select('*')
    .eq('id', executionId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to get execution: ${error.message}`);
  }

  return data as CadenceExecution;
}

/**
 * Get execution by company_cadence_id
 */
export async function getExecutionByCompanyCadence(
  supabase: SupabaseClient,
  companyCadenceId: string
): Promise<CadenceExecution | null> {
  const { data, error } = await supabase
    .from('cadence_executions')
    .select('*')
    .eq('company_cadence_id', companyCadenceId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to get execution: ${error.message}`);
  }

  return data as CadenceExecution;
}

/**
 * Schedule delayed execution
 */
export async function scheduleDelayedExecution(
  supabase: SupabaseClient,
  executionId: string,
  delayDays: number,
  delayHours: number,
  nextBlockId: string
): Promise<void> {
  const scheduledFor = new Date();
  scheduledFor.setDate(scheduledFor.getDate() + delayDays);
  scheduledFor.setHours(scheduledFor.getHours() + delayHours);

  await updateExecutionState(supabase, executionId, {
    current_block_id: nextBlockId,
    scheduled_for: scheduledFor,
    status: 'active',
  });
}

/**
 * Get scheduled executions ready to process
 * Also includes executions stuck at delay blocks (scheduled_for is null but current_block_id is delay)
 */
export async function getScheduledExecutions(supabase: SupabaseClient): Promise<CadenceExecution[]> {
  const now = new Date().toISOString();

  // Get executions that are scheduled and ready
  const { data: scheduledExecutions, error: scheduledError } = await supabase
    .from('cadence_executions')
    .select('*')
    .eq('status', 'active')
    .not('scheduled_for', 'is', null)
    .lte('scheduled_for', now)
    .order('scheduled_for', { ascending: true });

  if (scheduledError) {
    throw new Error(`Failed to get scheduled executions: ${scheduledError.message}`);
  }

  // Also get executions stuck at delay blocks (scheduled_for is null but they're at a delay block)
  // We need to get the cadence to check if current_block_id is a delay block
  const { data: allActiveExecutions, error: activeError } = await supabase
    .from('cadence_executions')
    .select('*, company_cadence:company_cadences(cadence_id)')
    .eq('status', 'active')
    .is('scheduled_for', null);

  if (activeError) {
    throw new Error(`Failed to get active executions: ${activeError.message}`);
  }

  const stuckDelayBlocks: CadenceExecution[] = [];
  
  if (allActiveExecutions && allActiveExecutions.length > 0) {
    for (const execution of allActiveExecutions) {
      const companyCadence = (execution as any).company_cadence;
      if (!companyCadence?.cadence_id) continue;

      // Get cadence to check block type
      const { data: cadence } = await supabase
        .from('cadences')
        .select('nodes')
        .eq('id', companyCadence.cadence_id)
        .single();

      if (cadence?.nodes) {
        const blocks = cadence.nodes as FlowBlock[];
        const currentBlock = blocks.find(b => b.id === execution.current_block_id);
        
        // If current block is a delay block and scheduled_for is null, it's stuck
        if (currentBlock?.type === 'delay') {
          stuckDelayBlocks.push(execution as CadenceExecution);
        }
      }
    }
  }

  // Combine scheduled executions and stuck delay blocks
  const allExecutions = [...(scheduledExecutions || []), ...stuckDelayBlocks];
  
  return allExecutions as CadenceExecution[];
}

/**
 * Execute next block in workflow - ACTUALLY EXECUTES THE BLOCK ACTIONS
 */
export async function executeNextBlock(
  supabase: SupabaseClient,
  execution: CadenceExecution,
  blocks: FlowBlock[],
  options?: { skipRecursion?: boolean }
): Promise<void> {
  // Safety check: Skip if execution is paused
  if (execution.status === 'paused') {
    console.log(`[Workflow] ⏸️ Skipping execution ${execution.id} - cadence is paused`);
    return;
  }

  const currentBlock = blocks.find(b => b.id === execution.current_block_id);
  if (!currentBlock) {
    console.error(`[Workflow] ❌ Block ${execution.current_block_id} not found in blocks array`);
    console.error(`[Workflow] Available block IDs: ${blocks.map(b => `${b.id} (${b.type})`).join(', ')}`);
    console.error(`[Workflow] Execution metadata:`, JSON.stringify(execution.metadata, null, 2));
    throw new Error(`Block ${execution.current_block_id} not found`);
  }


  // Get company and cadence info from metadata
  const metadata = execution.metadata || {};
  const companyId = metadata.company_id;
  const cadenceId = metadata.cadence_id;
  const storedUserId = metadata.user_id; // Get stored user_id from metadata

  if (!companyId || !cadenceId) {
    throw new Error('Company ID or Cadence ID missing from execution metadata');
  }

  // Get user - try auth first, but fall back to stored user_id if auth fails (after delays)
  // Background processor runs without auth session, so we MUST use stored user_id
  let user: any = null;
  const { data: { user: authUser }, error: userError } = await supabase.auth.getUser();
  
  if (authUser) {
    user = authUser;
    console.log(`[Workflow] ✅ Authenticated user: ${user.id} (${user.email})`);
  } else if (storedUserId) {
    // Auth failed (background processor has no session), use stored user_id
    // sendEmail only needs userId string, not full user object
    console.log(`[Workflow] ⚠️ Auth check failed (background processor), using stored user_id: ${storedUserId}`);
    user = { id: storedUserId }; // Minimal user object - just need id for sendEmail
    console.log(`[Workflow] ✅ Using stored user_id: ${user.id}`);
      } else {
    console.error('[Workflow] User auth error:', userError);
    throw new Error(`User not authenticated: ${userError?.message || 'No user found'}. Stored user_id: ${storedUserId || 'not set'}`);
  }

  console.log(`[Workflow] Executing block for user: ${user.id}`);

  // Get the first contact's email for this company (cadences email contacts directly)
  const { data: contacts } = await supabase
    .from('contacts')
    .select('email, first_name, last_name')
    .eq('company_id', companyId)
    .order('created_at', { ascending: true })
    .limit(1);

  // Use first contact's email, or fallback for testing
  const contactEmail = contacts && contacts.length > 0 && contacts[0].email 
    ? contacts[0].email 
    : 'ethanzzheng@gmail.com';
  
  // Get company phone (still used for voice calls)
  const { data: company } = await supabase
    .from('companies')
    .select('phone_number')
    .eq('id', companyId)
    .single();
  
  const companyPhone = company?.phone_number || '';

  // Get thread info from metadata
  // CRITICAL: Always start with empty threadInfoMap for new executions
  // Only use threadInfoMap entries that belong to THIS execution (from blocks executed in THIS run)
  const threadInfoMap = new Map<string, { threadId: string; messageId: string }>(
    Object.entries(metadata.threadInfoMap || {})
  );

  // Get execution order tracking - this tells us which blocks were executed in THIS execution
  const executedBlockIds: string[] = metadata.executedBlockIds || [];
  
  // CRITICAL: Calculate execution age to detect stale entries
  const executionAgeMs = Date.now() - new Date(execution.created_at).getTime();
  const executionAgeMinutes = Math.round(executionAgeMs / 60000);
  
  
  // CRITICAL SAFETY CHECK: Only keep threadInfoMap entries for blocks that:
  // 1. Exist in current cadence
  // 2. Were executed in THIS execution (tracked in executedBlockIds)
  // This prevents using old threadInfoMap entries from previous runs
  const currentBlockIds = new Set(blocks.map(b => b.id));
  const originalSize = threadInfoMap.size;
  const filteredThreadInfoMap = new Map<string, { threadId: string; messageId: string }>();
  
  threadInfoMap.forEach((info, blockId) => {
    const existsInCadence = currentBlockIds.has(blockId);
    const wasExecutedInThisRun = executedBlockIds.includes(blockId);
    
    if (existsInCadence && wasExecutedInThisRun) {
      // Block exists in current cadence AND was executed in THIS execution - keep it
      filteredThreadInfoMap.set(blockId, info);
    }
  });
  
  // Replace threadInfoMap with filtered version (clears any stale entries)
  threadInfoMap.clear();
  filteredThreadInfoMap.forEach((info, blockId) => threadInfoMap.set(blockId, info));
  
  // CRITICAL VALIDATION: If threadInfoMap has entries but executedBlockIds is empty,
  // this is suspicious - we might have stale data
  if (threadInfoMap.size > 0 && executedBlockIds.length === 0) {
    console.error(`[Workflow] ❌ CRITICAL: threadInfoMap has entries but executedBlockIds is EMPTY - clearing!`);
    threadInfoMap.clear();
  }

  // Handle delay block BEFORE switch (needs to advance to next block before scheduling)
  // SIMPLIFIED: Copy sourcing pattern - capture threadInfoMap BEFORE delay, use it AFTER
  if (currentBlock.type === 'delay') {
    const seconds = currentBlock.config?.delaySeconds || 0;
    const minutes = currentBlock.config?.delayMinutes || 0;
    const hours = currentBlock.config?.delayHours || 0;
    const days = currentBlock.config?.delayDays || 0;
    
    console.log(`[Workflow] ⏳ Delay block: ${days}d ${hours}h ${minutes}m ${seconds}s`);
    
    // CRITICAL: Check for replies BEFORE scheduling next email
    // This catches replies that happened during the delay period
    try {
      const { checkThreadForReply } = await import('@/lib/services/email-reply-detector');
      const threadIds = Object.values(threadInfoMap).map((info: any) => info?.threadId).filter(Boolean);
      
      if (threadIds.length > 0) {
        console.log(`[Workflow] 🔍 Checking for replies BEFORE delay block schedules next email...`);
        let hasReply = false;
        for (const threadId of threadIds) {
          const replyFound = await checkThreadForReply(
            user.id,
            threadId,
            contactEmail,
            supabase
          );
          if (replyFound) {
            hasReply = true;
            console.log(`[Workflow] ⏸️✅ Reply found in thread ${threadId} BEFORE delay block`);
            break;
          }
        }
        
        if (hasReply) {
          console.log(`[Workflow] ⏸️ Pausing execution ${execution.id} due to reply found before delay`);
          await updateExecutionState(supabase, execution.id, {
            status: 'paused',
            metadata: {
              ...metadata,
              paused_reason: 'email_reply_received',
              paused_at: new Date().toISOString(),
            },
          });

          await supabase
            .from('company_cadences')
            .update({ status: 'paused' })
            .eq('id', execution.company_cadence_id);
          
          console.log(`[Workflow] ⏸️ Execution ${execution.id} paused, stopping delay block`);
          return; // Stop processing - don't schedule next email
        }
      }
    } catch (replyError) {
      console.error('[Workflow] Error checking for replies before delay:', replyError);
      // Continue even if reply check fails
    }
    
    // CRITICAL: Capture threadInfoMap and executedBlockIds BEFORE delay (like sourcing does with closures)
    // This ensures we have the thread info from emails sent BEFORE this delay
    // IMPORTANT: threadInfoMap has already been filtered above, so it only contains entries from THIS execution
    const capturedThreadInfoMap = Object.fromEntries(threadInfoMap);
    const capturedExecutedBlockIds = [...executedBlockIds];
    
    // CRITICAL VALIDATION: Ensure captured entries are actually from THIS execution
    // Verify that all captured threadInfoMap entries have corresponding executedBlockIds
    const capturedBlockIds = Object.keys(capturedThreadInfoMap);
    const missingExecutionTracking = capturedBlockIds.filter(id => !capturedExecutedBlockIds.includes(id));
    if (missingExecutionTracking.length > 0) {
      console.error(`[Workflow] ❌❌❌ CRITICAL: Found ${missingExecutionTracking.length} threadInfoMap entries WITHOUT execution tracking!`);
      console.error(`[Workflow] ❌ Missing tracking for blocks:`, missingExecutionTracking);
      console.error(`[Workflow] ❌ These are STALE entries from previous executions - REMOVING them!`);
      // Remove stale entries
      missingExecutionTracking.forEach(id => delete capturedThreadInfoMap[id]);
      console.error(`[Workflow] ❌ Cleaned captured threadInfoMap: ${Object.keys(capturedThreadInfoMap).length} entries remain`);
    }
    
    // Track that this delay block was executed
    if (!capturedExecutedBlockIds.includes(currentBlock.id)) {
      capturedExecutedBlockIds.push(currentBlock.id);
    }
    
    console.log(`[Workflow] 💾 CAPTURED threadInfoMap before delay:`, {
      size: Object.keys(capturedThreadInfoMap).length,
      blockIds: Object.keys(capturedThreadInfoMap),
      executedBlockIds: capturedExecutedBlockIds,
      executionId: execution.id,
      executionCreatedAt: execution.created_at,
    });
    
    // Calculate total delay in milliseconds
    const totalMs = 
      (seconds * 1000) +
      (minutes * 60 * 1000) +
      (hours * 60 * 60 * 1000) +
      (days * 24 * 60 * 60 * 1000);
    
    const scheduledFor = new Date(Date.now() + totalMs);
    
    console.log(`[Workflow] ⏳ Scheduling next block for: ${scheduledFor.toISOString()}`);

    // Get the next block ID before scheduling
    const nextBlockId = currentBlock.connections && currentBlock.connections.length > 0 
      ? currentBlock.connections[0] 
      : null;

    if (!nextBlockId) {
      console.error(`[Workflow] ❌ Delay block has no next block!`);
      throw new Error('Delay block must have a connection to the next block');
    }

    // Save state with captured metadata
    const preservedMetadata = {
      ...metadata,
      threadInfoMap: capturedThreadInfoMap, // Use CAPTURED threadInfoMap
      executedBlockIds: capturedExecutedBlockIds,
    };

    await updateExecutionState(supabase, execution.id, {
      current_block_id: nextBlockId,
      scheduled_for: scheduledFor,
      metadata: preservedMetadata,
    });

    console.log(`[Workflow] ⏳ Scheduled next block (${nextBlockId}) for ${scheduledFor.toISOString()}`);
    console.log(`[Workflow] 💾 Preserved metadata with threadInfoMap size: ${Object.keys(capturedThreadInfoMap).length}`);
    console.log(`[Workflow] ⏸️ Delay block complete - execution will resume when background processor picks up scheduled execution`);
    
    // CRITICAL: Do NOT wait inline or recursively execute next block
    // The background processor (/api/cadence/process) will pick up this execution
    // when scheduled_for <= now and execute the next block
    // This ensures delays are properly respected and not executed immediately
    return; // Return immediately - background processor will handle continuation
  }

  switch (currentBlock.type) {
    case 'email': {
      console.log(`[Workflow] 📧 EMAIL BLOCK STARTING EXECUTION`);
      console.log(`[Workflow] 📧 User ID: ${metadata.user_id}`);
      console.log(`[Workflow] 📧 Company ID: ${companyId}`);
      
      // CRITICAL: Check for replies BEFORE sending email (especially for scheduled follow-ups)
      // This matches the sourcing directory pattern - check right before sending
      try {
        const { checkThreadForReply } = await import('@/lib/services/email-reply-detector');
        console.log(`[Workflow] 🔍 Checking for replies BEFORE sending email for execution ${execution.id}...`);
        
        // Get all thread IDs from this execution's threadInfoMap
        const threadIds = Object.values(threadInfoMap).map((info: any) => info?.threadId).filter(Boolean);
        
        if (threadIds.length > 0) {
          console.log(`[Workflow] 🔍 Found ${threadIds.length} thread(s) to check:`, threadIds);
          let hasReply = false;
          for (const threadId of threadIds) {
            console.log(`[Workflow] 🔍 Checking thread ${threadId} for replies...`);
            const replyFound = await checkThreadForReply(
              user.id,
              threadId,
              contactEmail,
              supabase
            );
            if (replyFound) {
              hasReply = true;
              console.log(`[Workflow] ⏸️✅✅✅ REPLY DETECTED in thread ${threadId} BEFORE sending email ✅✅✅`);
              break;
            } else {
              console.log(`[Workflow] ✅ No reply found in thread ${threadId}`);
            }
          }
          
          if (hasReply) {
            console.log(`[Workflow] ⏸️⏸️⏸️ PAUSING execution ${execution.id} due to reply found before email send ⏸️⏸️⏸️`);
            await updateExecutionState(supabase, execution.id, {
              status: 'paused',
              metadata: {
                ...metadata,
                paused_reason: 'email_reply_received',
                paused_at: new Date().toISOString(),
              },
            });

            await supabase
              .from('company_cadences')
              .update({ status: 'paused' })
              .eq('id', execution.company_cadence_id);
            
            console.log(`[Workflow] ⏸️ Execution ${execution.id} PAUSED, stopping email send`);
            return; // Stop processing - don't send email
          } else {
            console.log(`[Workflow] ✅ No replies found in any thread, proceeding with email send`);
          }
        } else {
          console.log(`[Workflow] ⚠️ No thread IDs found in threadInfoMap - this is the first email`);
        }
      } catch (replyError) {
        console.error('[Workflow] ❌ Error checking for replies before send:', replyError);
        // Continue even if reply check fails - don't block email sending if check fails
      }
      
      const { sendEmail } = await import('@/lib/services/gmail-direct');
      const { 
        replaceBasicVariables, 
        hasPersonalizationVariable, 
        replacePersonalizationPlaceholder,
        generatePersonalization
      } = await import('@/lib/utils/email-variables');
      
      if (!contactEmail) {
        console.error(`[Workflow] ❌ No contact email found for company ${companyId}`);
        throw new Error(`No contacts found for company ${companyId}. Please add at least one contact with an email address.`);
      }

      // Fetch company and contact data for variable replacement
      console.log(`[Workflow] 📧 Fetching company and contact data for variables...`);
      const { data: companyData } = await supabase
        .from('companies')
        .select('name, description, website')
        .eq('id', companyId)
        .single();

      // Get contact info for the email recipient
      let contactName: string | undefined;
      const { data: contact } = await supabase
        .from('contacts')
        .select('first_name, last_name')
        .eq('email', contactEmail)
        .eq('company_id', companyId)
        .maybeSingle();

      if (contact?.first_name) {
        contactName = contact.first_name;
      }

      const companyName = companyData?.name || '';
      const companyDescription = companyData?.description || '';
      const companyWebsite = companyData?.website || '';

      console.log(`[Workflow] 📧 Variable context:`, {
        contactName,
        companyName,
        hasDescription: !!companyDescription,
        hasWebsite: !!companyWebsite,
      });

      // Replace basic variables in subject and body
      let finalSubject = currentBlock.config?.subject || '';
      let finalBody = currentBlock.config?.body || '';

      finalSubject = replaceBasicVariables(finalSubject, {
        contactName,
        companyName,
        companyDescription,
        companyWebsite,
      });

      finalBody = replaceBasicVariables(finalBody, {
        contactName,
        companyName,
        companyDescription,
        companyWebsite,
      });

      // Handle {personalization} variable if present
      if (hasPersonalizationVariable(finalBody)) {
        console.log(`[Workflow] 📧 Generating personalization...`);
        const personalization = await generatePersonalization(
          finalBody,
          companyName,
          companyDescription,
          companyWebsite
        );
        finalBody = replacePersonalizationPlaceholder(finalBody, personalization);
        console.log(`[Workflow] 📧 Personalization generated: "${personalization}"`);
      }

      console.log(`[Workflow] 📧 Sending email to ${contactEmail}`);
      console.log(`[Workflow] 📧 Subject: ${finalSubject || '(empty)'}`);
      console.log(`[Workflow] 📧 Body length: ${finalBody.length} characters`);
      
      // Check if user has valid session before attempting to send
      console.log(`[Workflow] 📧 Checking user session for user_id: ${metadata.user_id}...`);
      const { data: userSession, error: sessionError } = await supabase
        .from('user_sessions')
        .select('access_token, refresh_token, email')
        .eq('user_id', metadata.user_id)
        .single();
      
      if (sessionError || !userSession) {
        console.error(`[Workflow] ❌ No user session found:`, sessionError);
        throw new Error(`No Google OAuth session found. Please sign in with Google and grant Gmail permissions.`);
      }
      
      if (!userSession.access_token) {
        console.error(`[Workflow] ❌ No access token in user session`);
        throw new Error(`No access token found. Please sign in with Google and grant Gmail permissions.`);
      }
      
      // CLIENT-SIDE LOGGING: Also log to browser console via fetch
      try {
        await fetch('/api/cadence/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            level: 'info',
            message: `📧 EMAIL BLOCK: ${currentBlock.id}`,
            data: {
              subject: currentBlock.config?.subject || '(empty)',
              threadSelection: currentBlock.config?.threadSelection || (currentBlock.config?.replyToThread ? 'previous' : 'new'),
            }
          })
        }).catch(() => {}); // Ignore errors
      } catch {}
      
      if (!currentBlock.config?.subject || !currentBlock.config?.body) {
        console.error(`[Workflow] ❌ Email block missing subject or body`);
        console.error(`[Workflow] ❌ Subject:`, currentBlock.config?.subject);
        console.error(`[Workflow] ❌ Body:`, currentBlock.config?.body);
        throw new Error(`Email block is missing subject or body. Please configure the email block in the cadence editor.`);
      }
      
      // Determine thread selection
      const threadSelection = currentBlock.config?.threadSelection || 
                             (currentBlock.config?.replyToThread ? 'previous' : 'new');
      
      console.log(`[Workflow] ========== EMAIL BLOCK THREADING ANALYSIS ==========`);
      console.log(`[Workflow] 📧 Current Email Block ID: ${currentBlock.id}`);
      console.log(`[Workflow] 📧 Current Email Block Title: ${currentBlock.title}`);
      console.log(`[Workflow] 📧 Thread Selection Config: ${threadSelection}`);
      console.log(`[Workflow] 📧 Execution ID: ${execution.id}`);
      console.log(`[Workflow] 📧 Execution Created At: ${execution.created_at}`);
      console.log(`[Workflow] 📧 Current Time: ${new Date().toISOString()}`);
      console.log(`[Workflow] 📧 Time Since Execution Start: ${Math.round((Date.now() - new Date(execution.created_at).getTime()) / 1000)} seconds`);
      console.log(`[Workflow] 📧 threadInfoMap Size: ${threadInfoMap.size}`);
      console.log(`[Workflow] 📧 threadInfoMap Entries:`, Array.from(threadInfoMap.entries()).map(([id, info]) => ({
        blockId: id,
        threadId: info.threadId,
        messageId: info.messageId?.substring(0, 50) + '...',
        blockExists: blocks.some(b => b.id === id),
        blockType: blocks.find(b => b.id === id)?.type || 'NOT FOUND'
      })));
      console.log(`[Workflow] ==================================================`);
      
      let threadId: string | undefined = undefined;
      let messageId: string | undefined = undefined;
      
      if (threadSelection !== 'new') {
        // Find the MOST RECENT email block in the same thread (not the first one!)
        let selectedBlockId: string | undefined = undefined;
        
        if (threadSelection === 'previous') {
          // CRITICAL: Find the MOST RECENTLY EXECUTED email block (not just last in array!)
          // Use executedBlockIds to determine execution order - the LAST email block in executedBlockIds
          // is the most recently executed one
          const emailBlocksWithThreadInfo = blocks
            .filter(b => b.type === 'email' && b.id !== currentBlock.id && threadInfoMap.has(b.id))
            .map(b => ({
              block: b,
              threadInfo: threadInfoMap.get(b.id)!,
              executionIndex: executedBlockIds.indexOf(b.id), // Index in execution order (-1 if not executed)
            }))
            .filter(item => item.executionIndex >= 0); // Only blocks executed in THIS execution
          
          // Sort by execution order (most recent = highest index in executedBlockIds)
          emailBlocksWithThreadInfo.sort((a, b) => b.executionIndex - a.executionIndex);
          
          const selectedBlock = emailBlocksWithThreadInfo[0]; // Most recently executed
          selectedBlockId = selectedBlock?.block.id;
          
          console.log(`[Workflow] 🔍 Finding MOST RECENTLY EXECUTED email block (previous mode)`);
          console.log(`[Workflow]   Execution order (executedBlockIds):`, executedBlockIds);
          console.log(`[Workflow]   Available email blocks with threadInfo (sorted by execution order):`, emailBlocksWithThreadInfo.map(e => ({
            blockId: e.block.id,
            executionIndex: e.executionIndex,
            threadId: e.threadInfo.threadId,
            messageId: e.threadInfo.messageId?.substring(0, 50) + '...',
            isMostRecent: emailBlocksWithThreadInfo.indexOf(e) === 0,
          })));
          console.log(`[Workflow]   Selected (most recently executed): ${selectedBlockId} (execution index: ${selectedBlock?.executionIndex})`);
          
          // CRITICAL VALIDATION: Verify selected block is actually executed in THIS execution
          if (selectedBlockId && !executedBlockIds.includes(selectedBlockId)) {
            console.error(`[Workflow] ❌❌❌ CRITICAL: Selected block ${selectedBlockId} is NOT in executedBlockIds!`);
            console.error(`[Workflow] ❌ This is a STALE entry - clearing threadInfoMap for this block!`);
            threadInfoMap.delete(selectedBlockId);
            selectedBlockId = undefined; // Clear selection
            console.error(`[Workflow] ❌ Will create NEW thread instead of replying to old one`);
          }
          
          if (selectedBlock) {
            console.log(`[Workflow]   ✅ Selected block thread info:`, {
              blockId: selectedBlock.block.id,
              executionIndex: selectedBlock.executionIndex,
              threadId: selectedBlock.threadInfo.threadId,
              messageId: selectedBlock.threadInfo.messageId?.substring(0, 50) + '...',
              isFromThisExecution: executedBlockIds.includes(selectedBlock.block.id),
              executionId: execution.id,
              executionCreatedAt: execution.created_at,
              executionAgeMinutes: executionAgeMinutes,
            });
          } else {
            console.error(`[Workflow] ❌ No email blocks found that were executed in THIS execution!`);
            console.error(`[Workflow] ❌ executedBlockIds:`, executedBlockIds);
            console.error(`[Workflow] ❌ threadInfoMap keys:`, Array.from(threadInfoMap.keys()));
          }
        } else {
          // Specific block ID selected
          selectedBlockId = threadSelection;
        }
        
        console.log(`[Workflow] 🔍 Thread selection: ${threadSelection}, selectedBlockId: ${selectedBlockId}`);
        console.log(`[Workflow] 🔍 Available threadInfoMap entries:`, Array.from(threadInfoMap.keys()));
        console.log(`[Workflow] 🔍 ThreadInfoMap size: ${threadInfoMap.size}`);
        
        if (!selectedBlockId) {
          console.error(`[Workflow] ❌ CRITICAL: selectedBlockId is null/undefined!`);
          console.error(`[Workflow] ❌ threadSelection: ${threadSelection}`);
          console.error(`[Workflow] ❌ Available email blocks:`, blocks.filter(b => b.type === 'email').map(b => b.id));
        }
        
        if (selectedBlockId && threadInfoMap.has(selectedBlockId)) {
          const threadInfo = threadInfoMap.get(selectedBlockId)!;
          
          console.log(`[Workflow] ========== FOUND THREAD INFO ==========`);
          console.log(`[Workflow] ✅ Selected Block ID: ${selectedBlockId}`);
          console.log(`[Workflow] ✅ Selected Block Title: ${blocks.find(b => b.id === selectedBlockId)?.title || 'NOT FOUND'}`);
          console.log(`[Workflow] ✅ Thread ID: ${threadInfo.threadId}`);
          console.log(`[Workflow] ✅ Message ID: ${threadInfo.messageId}`);
          console.log(`[Workflow] ⚠️⚠️⚠️ ABOUT TO REPLY TO THIS THREAD ⚠️⚠️⚠️`);
          console.log(`[Workflow] ⚠️ VERIFY: Is this thread from THIS execution or a PREVIOUS execution?`);
          console.log(`[Workflow] ⚠️ Check execution.created_at vs when this thread was created`);
          console.log(`[Workflow] ==========================================`);
          
          threadId = threadInfo.threadId;
          
          console.log(`[Workflow] 🔍 Found thread info for block ${selectedBlockId}:`, {
            threadId: threadInfo.threadId,
            messageId: threadInfo.messageId
          });
          
          // CRITICAL: Use the MOST RECENT email's Message-ID for In-Reply-To
          // This ensures we reply to the latest email, not the first one!
          // Find the MOST RECENT email block in this thread (the one we're replying to)
          let mostRecentMessageId = threadInfo.messageId;
          let mostRecentBlockId = selectedBlockId;
          
          // Also find the FIRST email's Message-ID for References header (full thread chain)
          let firstMessageId = threadInfo.messageId;
          let firstBlockId = selectedBlockId;
          
          // Find all email blocks in this thread
          // CRITICAL: Only include blocks that were executed in THIS execution
          const blocksInThread = blocks
            .filter(b => 
              b.type === 'email' && 
              threadInfoMap.has(b.id) &&
              executedBlockIds.includes(b.id) // CRITICAL: Only blocks executed in THIS execution
            )
            .map(b => {
              const blockThreadInfo = threadInfoMap.get(b.id)!;
              return { 
                block: b, 
                threadInfo: blockThreadInfo,
                executionIndex: executedBlockIds.indexOf(b.id) // Track execution order
              };
            })
            .filter(item => item.threadInfo.threadId === threadId)
            .sort((a, b) => b.executionIndex - a.executionIndex); // Sort by execution order (most recent first)
          
          if (blocksInThread.length > 0) {
            // Most recent is the FIRST one (sorted by execution order descending - most recent first)
            const mostRecentBlockInThread = blocksInThread[0];
            mostRecentMessageId = mostRecentBlockInThread.threadInfo.messageId;
            mostRecentBlockId = mostRecentBlockInThread.block.id;
            
            // First is the LAST one (sorted by execution order - oldest first)
            const oldestBlockInThread = blocksInThread[blocksInThread.length - 1];
            firstMessageId = oldestBlockInThread.threadInfo.messageId;
            firstBlockId = oldestBlockInThread.block.id;
            
            console.log(`[Workflow] 🔍 Thread analysis (execution order):`, {
              totalBlocksInThread: blocksInThread.length,
              executionOrder: blocksInThread.map(b => ({
                blockId: b.block.id,
                executionIndex: b.executionIndex,
                isMostRecent: blocksInThread.indexOf(b) === 0,
                isOldest: blocksInThread.indexOf(b) === blocksInThread.length - 1,
              }))
            });
            
            console.log(`[Workflow] 🔍 Found ${blocksInThread.length} emails in thread:`);
            console.log(`[Workflow]   FIRST (thread starter): block ${firstBlockId}, Message-ID: ${firstMessageId.substring(0, 50)}...`);
            console.log(`[Workflow]   MOST RECENT (replying to): block ${mostRecentBlockId}, Message-ID: ${mostRecentMessageId.substring(0, 50)}...`);
          }
          
          // Use MOST RECENT Message-ID for In-Reply-To (replying to latest email)
          messageId = mostRecentMessageId;
          console.log(`[Workflow] ✅ Using MOST RECENT message ID for In-Reply-To:`);
          console.log(`[Workflow]   Thread ID: ${threadId}`);
          console.log(`[Workflow]   Most Recent Message ID (In-Reply-To): ${messageId}`);
          console.log(`[Workflow]   Most Recent Block ID: ${mostRecentBlockId}`);
          console.log(`[Workflow]   First Message ID (for References): ${firstMessageId}`);
          console.log(`[Workflow]   Message-ID format check:`, {
            hasAngleBrackets: messageId.startsWith('<') && messageId.endsWith('>'),
            length: messageId.length,
            preview: messageId.substring(0, 30) + '...'
          });
          
          // IMPORTANT: Use the original subject exactly as stored (from the FIRST email in thread)
          const firstEmailBlock = blocks.find(b => b.id === firstBlockId);
          const originalSubject = firstEmailBlock?.config?.subject || '';
          const currentSubject = currentBlock.config?.subject || '';
          console.log(`[Workflow]   Subject comparison:`, {
            firstEmailSubject: originalSubject,
            currentBlockSubject: currentSubject,
            match: originalSubject === currentSubject
          });
          
          if (originalSubject) {
            // Force subject to match original for threading
            // Variables will be replaced later in the process
            finalSubject = originalSubject;
            // Also replace variables in the original subject
            finalSubject = replaceBasicVariables(finalSubject, {
              contactName,
              companyName,
              companyDescription,
              companyWebsite,
            });
            currentBlock.config = { ...currentBlock.config, subject: originalSubject };
            console.log(`[Workflow]   Subject locked to FIRST email's subject: "${originalSubject}"`);
            console.log(`[Workflow]   Final subject (with variables): "${finalSubject}"`);
          } else {
            console.error(`[Workflow] ❌ WARNING: Could not find original subject for first email block ${firstBlockId}`);
          }
          
          // Store both Message-IDs in metadata for proper References header
          // We'll use mostRecentMessageId for In-Reply-To and firstMessageId for References
          // But for now, pass mostRecentMessageId as messageId
          // The gmail-direct.ts will handle References properly
        } else {
          console.error(`[Workflow] ❌ CRITICAL ERROR: Selected thread block ${selectedBlockId} not found in threadInfoMap!`);
          console.error(`[Workflow] ❌ Available blocks in threadInfoMap:`, Array.from(threadInfoMap.keys()));
          console.error(`[Workflow] ❌ This means the previous email hasn't been sent yet, or threading info wasn't saved.`);
          console.log(`[Workflow]   ⚠️ Warning: Selected thread block not found or hasn't sent yet. Creating new thread.`);
        }
      } else {
        console.log(`[Workflow] 📧 Sending NEW email (not replying to thread)`);
      }

      try {
        console.log(`[Workflow] 📧 About to call sendEmail with threading info:`);
        console.log(`[Workflow]   To: ${contactEmail}`);
        console.log(`[Workflow]   Subject: "${finalSubject}"`);
        console.log(`[Workflow]   Thread ID: ${threadId || 'NEW THREAD'}`);
        console.log(`[Workflow]   Message-ID: ${messageId || 'NONE'}`);
        console.log(`[Workflow]   Current block ID: ${currentBlock.id}`);
        console.log(`[Workflow]   Thread selection mode: ${threadSelection}`);
        if (threadId) {
          console.log(`[Workflow]   ⚠️⚠️⚠️ REPLYING TO EXISTING THREAD ⚠️⚠️⚠️`);
          console.log(`[Workflow]   ⚠️ Thread ID: ${threadId}`);
          console.log(`[Workflow]   ⚠️ Message-ID: ${messageId}`);
          console.log(`[Workflow]   ⚠️ This email will be added to thread: ${threadId}`);
        } else {
          console.log(`[Workflow]   ✅ Creating NEW thread`);
        }
        
        console.log(`[Workflow] 📧 CALLING sendEmail NOW...`);
        console.log(`[Workflow] 📧 User ID: ${user.id}`);
        console.log(`[Workflow] 📧 To: ${contactEmail}`);
        console.log(`[Workflow] 📧 Subject: "${finalSubject}"`);
        console.log(`[Workflow] 📧 Body length: ${finalBody.length} chars`);
        
        const result = await sendEmail(user.id, {
          to: contactEmail,
          subject: finalSubject,
          body: finalBody,
          threadId,
          messageId,
        }, supabase);

        console.log(`[Workflow] ✅✅✅ EMAIL SENT SUCCESSFULLY! ✅✅✅`);
        console.log(`[Workflow]   Returned Thread ID: ${result.threadId}`);
        console.log(`[Workflow]   Returned Message ID: ${result.messageId}`);
        console.log(`[Workflow]   Gmail Message ID: ${result.gmailMessageId}`);
        
        // CLIENT-SIDE LOGGING
        try {
          await fetch('/api/cadence/log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              level: 'success',
              message: `✅ Email sent`,
              data: {
                threadId: result.threadId,
                messageId: result.messageId,
                subject: currentBlock.config?.subject
              }
            })
          }).catch(() => {});
        } catch {}
        
        // CRITICAL: Always use Gmail's returned threadId (it's the source of truth)
        // If threading worked, it will match what we sent. If it didn't, we need to use what Gmail says.
        const finalThreadId = result.threadId; // Always use Gmail's returned threadId
        const finalMessageId = result.messageId; // Always use the actual Message-ID from headers
        
        console.log(`[Workflow] 🧵 Thread ID decision:`, {
          wasReplying: !!threadId,
          sentThreadId: threadId || 'NEW',
          returnedThreadId: result.threadId,
          usingThreadId: finalThreadId,
          threadingWorked: threadId ? threadId === result.threadId : true // For new threads, always true
        });

        // Store thread info IMMEDIATELY
        threadInfoMap.set(currentBlock.id, {
          threadId: finalThreadId, // Use Gmail's returned threadId (source of truth)
          messageId: finalMessageId,
        });
        
        console.log(`[Workflow] 💾 Storing thread info for block ${currentBlock.id}:`, {
          threadId: result.threadId,
          messageId: result.messageId,
          messageIdFormat: {
            hasAngleBrackets: result.messageId.startsWith('<') && result.messageId.endsWith('>'),
            length: result.messageId.length,
            firstChars: result.messageId.substring(0, 20),
            lastChars: result.messageId.substring(result.messageId.length - 10)
          }
        });
        
        // CRITICAL: Track that this block was executed (for execution order tracking)
        const updatedExecutedBlockIds = executedBlockIds.includes(currentBlock.id)
          ? executedBlockIds // Already tracked
          : [...executedBlockIds, currentBlock.id]; // Add to execution order
        
        // Save metadata IMMEDIATELY so it's available for next blocks
        const updatedMetadata = {
          ...metadata,
          threadInfoMap: Object.fromEntries(threadInfoMap),
          executedBlockIds: updatedExecutedBlockIds, // CRITICAL: Track execution order
        };
        
        console.log(`[Workflow] 💾 Saving threadInfoMap to Supabase (${threadInfoMap.size} entries):`, 
          Array.from(threadInfoMap.entries()).map(([id, info]) => ({
            blockId: id,
            threadId: info.threadId,
            messageId: info.messageId
          }))
        );
        console.log(`[Workflow] 📝 Updated executedBlockIds:`, updatedExecutedBlockIds);
        
        await updateExecutionState(supabase, execution.id, {
          metadata: updatedMetadata,
        });
        
        console.log(`[Workflow] 💾 Saved threadInfoMap to Supabase:`, {
          blockId: currentBlock.id,
          threadId: result.threadId,
          messageId: result.messageId,
          totalThreads: threadInfoMap.size
        });

        // Check for replies after sending email (wait a bit for Gmail to sync)
        // Note: Background processor will also check periodically
        try {
          await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds for Gmail to sync
          const { checkThreadForReply } = await import('@/lib/services/email-reply-detector');
          console.log(`[Workflow] 🔍 Checking for replies after email send in thread ${finalThreadId}...`);
          
          const hasReply = await checkThreadForReply(
            user.id,
            finalThreadId,
            contactEmail,
            supabase
          );
          
          if (hasReply) {
            console.log(`[Workflow] ⏸️✅✅✅ REPLY DETECTED in thread ${finalThreadId}, pausing execution ${execution.id} ✅✅✅`);
            // Pause the cadence execution
            await updateExecutionState(supabase, execution.id, {
              status: 'paused',
              metadata: {
                ...updatedMetadata,
                paused_reason: 'email_reply_received',
                paused_at: new Date().toISOString(),
              },
            });

            // Also update company_cadence status
            const { error: ccUpdateError } = await supabase
              .from('company_cadences')
              .update({
                status: 'paused',
              })
              .eq('id', execution.company_cadence_id);
            
            if (ccUpdateError) {
              console.error(`[Workflow] Error updating company_cadence status:`, ccUpdateError);
            }
            
            console.log(`[Workflow] ⏸️ Execution ${execution.id} paused due to email reply`);
            return; // Stop processing this execution
          } else {
            console.log(`[Workflow] ✅ No reply found, continuing...`);
          }
        } catch (replyError) {
          console.error('[Workflow] Error checking for replies after send:', replyError);
          // Continue even if reply check fails
        }

        // Log email
        const { error: logError } = await supabase
          .from('email_logs')
          .insert({
            company_id: companyId,
            cadence_id: cadenceId,
            direction: 'sent',
            subject: currentBlock.config?.subject || '',
            body: currentBlock.config?.body || '',
            thread_id: result.threadId,
            message_id: result.messageId,
            from_email: user.email || '', // May be empty if using stored user_id
            to_email: contactEmail,
            sent_at: new Date().toISOString(),
          });

        if (logError) {
          console.error(`[Workflow] Error logging email:`, logError);
        } else {
          console.log(`[Workflow] Email logged successfully`);
        }
      } catch (emailError: any) {
        console.error(`[Workflow] ❌❌❌ CRITICAL ERROR SENDING EMAIL:`, emailError);
        console.error(`[Workflow] ❌ Error message:`, emailError.message);
        console.error(`[Workflow] ❌ Error stack:`, emailError.stack);
        console.error(`[Workflow] ❌ Error name:`, emailError.name);
        console.error(`[Workflow] ❌ Error code:`, emailError.code);
        console.error(`[Workflow] ❌ Full error:`, JSON.stringify(emailError, Object.getOwnPropertyNames(emailError)));
        throw new Error(`Failed to send email: ${emailError.message || String(emailError)}`);
      }

      console.log(`[Workflow] 📧 EMAIL BLOCK COMPLETED SUCCESSFULLY`);
      console.log(`[Workflow] 📧 About to determine next block...`);
      break;
    }

    case 'voicecall': {
      console.log(`[Workflow] 📞 VOICE CALL BLOCK STARTING EXECUTION`);
      const { sendVoiceCall } = await import('@/lib/services/vapi');
      
      // Use phone number from company record
      const phoneNumber = companyPhone || '';
      if (!phoneNumber) {
        throw new Error('Company phone number not found. Please set it in company details.');
      }

      // Get company name for personalized message
      const { data: companyInfo } = await supabase
        .from('companies')
        .select('name')
        .eq('id', companyId)
        .single();

      const companyName = companyInfo?.name;

      console.log(`[Workflow] 📞 Initiating voice call to ${phoneNumber}`);
      console.log(`[Workflow] 📞 Company: ${companyName || '(unknown)'}`);

      const result = await sendVoiceCall({
        phoneNumber,
        companyId,
        cadenceId,
        companyName: companyName,
        customPrompt: currentBlock.config?.customPrompt, // Use custom prompt if provided
        voicemailMessage: currentBlock.config?.voicemailMessage, // Custom voicemail message if provided
        enableVoicemailFallback: currentBlock.config?.enableVoicemailFallback !== false, // Default to true
      });

      console.log(`[Workflow] ✅ Voice call initiated. Call ID: ${result.callId}, Status: ${result.status}`);

      // Log voice call to company_content table (for backward compatibility)
      const { error: logError } = await supabase
        .from('company_content')
        .insert({
          company_id: companyId,
          cadence_id: cadenceId,
          content_type: 'outreach_log',
          content: `Voice call initiated: AI agent call to schedule meeting with ${companyName || 'company'}`,
          source: 'CRM Cadence',
          metadata: {
            cadence_id: cadenceId,
            vapi_call_id: result.callId,
            vapi_status: result.status,
            phone_number: phoneNumber,
            call_type: 'voice_call',
            company_name: companyName,
            custom_prompt_used: !!currentBlock.config?.customPrompt,
          },
        });

      if (logError) {
        console.error(`[Workflow] Error logging voice call to company_content:`, logError);
      } else {
        console.log(`[Workflow] Voice call logged successfully to company_content`);
      }

      // Also log to call_logs table
      const { error: callLogError } = await supabase
        .from('call_logs')
        .insert({
          company_id: companyId,
          cadence_id: cadenceId,
          call_type: 'voice_call',
          direction: 'outbound',
          phone_number: phoneNumber,
          vapi_call_id: result.callId,
          status: result.status,
          metadata: {
            cadence_id: cadenceId,
            company_name: companyName,
            custom_prompt_used: !!currentBlock.config?.customPrompt,
          },
        });

      if (callLogError) {
        console.error(`[Workflow] Error logging voice call to call_logs:`, callLogError);
      } else {
        console.log(`[Workflow] Voice call logged successfully to call_logs`);
      }

      break;
    }

    case 'trigger':
      // Trigger block just starts the flow - follow connections
      console.log(`[Workflow] Trigger block executed, following connections...`);
      break;

    default:
      // Handle deprecated or unknown block types
      if (currentBlock.type === 'voicemail') {
        console.log(`[Workflow] ⚠️ Skipping deprecated block type: ${currentBlock.type}`);
      } else {
        console.log(`[Workflow] ⚠️ Unknown block type: ${currentBlock.type}, skipping`);
      }
      break;
  }

  // Update metadata with thread info (for blocks that don't save it immediately)
  // CRITICAL: Track execution order for all blocks (email blocks track it themselves, but others don't)
  const updatedExecutedBlockIds = executedBlockIds.includes(currentBlock.id)
    ? executedBlockIds // Already tracked (e.g., email block tracks itself)
    : [...executedBlockIds, currentBlock.id]; // Add to execution order
  
  const updatedMetadata = {
    ...metadata,
    threadInfoMap: Object.fromEntries(threadInfoMap),
    executedBlockIds: updatedExecutedBlockIds, // CRITICAL: Track execution order for all blocks
  };

  // Determine next block based on current block type
  // Note: delay blocks already returned above
  let nextBlockId: string | null = null;

  if (currentBlock.type === 'trigger') {
    // Follow first connection that isn't the trigger itself
    if (currentBlock.connections && currentBlock.connections.length > 0) {
      // Filter out connections that point to the trigger block itself
      const validConnections = currentBlock.connections.filter(connId => connId !== currentBlock.id);
      if (validConnections.length > 0) {
        nextBlockId = validConnections[0];
      } else {
        // If all connections are self-references, try the first one anyway (shouldn't happen)
      nextBlockId = currentBlock.connections[0];
        console.error(`[Workflow] ⚠️ Warning: All connections point to trigger itself`);
      }
    } else {
      console.error(`[Workflow] ❌ Trigger block has no connections!`);
    }
  } else {
    // Regular blocks (email, voicecall) follow their connection
    if (currentBlock.connections && currentBlock.connections.length > 0) {
      nextBlockId = currentBlock.connections[0];
    } else {
      console.log(`[Workflow] ⚠️ ${currentBlock.type} block has no connections`);
    }
  }

  if (nextBlockId) {
    const nextBlock = blocks.find(b => b.id === nextBlockId);
    
    if (!nextBlock) {
      console.error(`[Workflow] ❌ Next block ${nextBlockId} NOT FOUND in blocks array!`);
      throw new Error(`Next block ${nextBlockId} not found`);
    }
    
    // CRITICAL: When advancing to next block, clear scheduled_for for non-delay blocks
    // Delay blocks will set their own scheduled_for when they execute
    // For delay blocks, we can clear it too since they'll set it themselves
    await updateExecutionState(supabase, execution.id, {
      current_block_id: nextBlockId,
      scheduled_for: null, // Clear scheduled_for - delay blocks will set it, other blocks don't need it
      metadata: updatedMetadata,
    });
    
    // CRITICAL: Skip recursive execution if this was called from background processor
    // This prevents double execution when background processor picks up scheduled executions
    if (options?.skipRecursion) {
      console.log(`[Workflow] Skipping recursive execution (called from background processor) to prevent double-processing`);
      return;
    }
    
    // Recursively execute next block
    // CRITICAL: Delay blocks MUST be executed immediately so they can set scheduled_for
    // Delay blocks return early after setting scheduled_for, so recursion will stop there
    const updatedExecution = await getExecution(supabase, execution.id);
    if (updatedExecution && updatedExecution.current_block_id === nextBlockId) {
      await executeNextBlock(supabase, updatedExecution, blocks);
    }
  } else {
    // No next block, mark as completed
    console.log(`[Workflow] No next block found, marking workflow as completed for execution ${execution.id}`);
    await updateExecutionState(supabase, execution.id, {
      status: 'completed',
      metadata: updatedMetadata,
    });
    
    const { error: updateError } = await supabase
      .from('company_cadences')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', execution.company_cadence_id);
    
    if (updateError) {
      console.error(`[Workflow] Error updating company_cadence status:`, updateError);
    } else {
      console.log(`[Workflow] Successfully marked workflow as completed`);
    }
  }
}

