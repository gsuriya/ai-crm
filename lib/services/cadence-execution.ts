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
  blocks: FlowBlock[]
): Promise<void> {
  const currentBlock = blocks.find(b => b.id === execution.current_block_id);
  if (!currentBlock) {
    console.error(`[Workflow] ❌ Block ${execution.current_block_id} not found in blocks array`);
    console.error(`[Workflow] Available block IDs: ${blocks.map(b => `${b.id} (${b.type})`).join(', ')}`);
    console.error(`[Workflow] Execution metadata:`, JSON.stringify(execution.metadata, null, 2));
    throw new Error(`Block ${execution.current_block_id} not found`);
  }

  console.log(`[Workflow] ✅ Found current block:`, {
    id: currentBlock.id,
    type: currentBlock.type,
    title: currentBlock.title,
    connections: currentBlock.connections || [],
  });

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

  // Get company email and phone
  const { data: company } = await supabase
    .from('companies')
    .select('email, phone_number')
    .eq('id', companyId)
    .single();

  // Use hardcoded email for testing: ethanzzheng@gmail.com
  const companyEmail = 'ethanzzheng@gmail.com';
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
  
  console.log(`[Workflow] 📋 Loaded threadInfoMap from execution metadata:`, {
    size: threadInfoMap.size,
    executionId: execution.id,
    executionCreatedAt: execution.created_at,
    executionAgeMinutes: executionAgeMinutes,
    executedBlockIdsCount: executedBlockIds.length,
    executedBlockIds: executedBlockIds,
    entries: Array.from(threadInfoMap.entries()).map(([id, info]) => ({
      blockId: id,
      threadId: info.threadId,
      messageId: info.messageId?.substring(0, 50) + '...',
      wasExecutedInThisRun: executedBlockIds.includes(id),
    }))
  });
  
  // CRITICAL DEBUG: Log the full threadInfoMap contents
  if (threadInfoMap.size > 0) {
    console.log(`[Workflow] 🔍 FULL threadInfoMap contents (these are the threads we can reply to):`);
    threadInfoMap.forEach((info, blockId) => {
      const wasExecuted = executedBlockIds.includes(blockId);
      console.log(`[Workflow]   Block ${blockId}: Thread ${info.threadId}, Message ${info.messageId?.substring(0, 40)}..., Executed in THIS run: ${wasExecuted}`);
    });
  } else {
    console.log(`[Workflow] ✅ threadInfoMap is EMPTY - starting fresh for this execution`);
  }
  
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
      console.log(`[Workflow] ✅ Keeping threadInfoMap entry for block ${blockId} (executed in THIS execution)`);
    } else {
      if (!existsInCadence) {
        console.log(`[Workflow] ⚠️ Filtering out threadInfoMap entry for block ${blockId} (not in current cadence)`);
      }
      if (!wasExecutedInThisRun) {
        console.log(`[Workflow] ⚠️⚠️⚠️ CRITICAL: Filtering out threadInfoMap entry for block ${blockId} (NOT executed in THIS execution - STALE from previous run!)`);
        console.log(`[Workflow] ⚠️   Execution age: ${executionAgeMinutes} minutes`);
        console.log(`[Workflow] ⚠️   executedBlockIds:`, executedBlockIds);
        console.log(`[Workflow] ⚠️   This entry would cause replies to OLD threads!`);
      }
    }
  });
  
  // Replace threadInfoMap with filtered version (clears any stale entries)
  threadInfoMap.clear();
  filteredThreadInfoMap.forEach((info, blockId) => threadInfoMap.set(blockId, info));
  
  if (originalSize !== threadInfoMap.size) {
    console.log(`[Workflow] 🧹 Cleaned threadInfoMap: ${originalSize} -> ${threadInfoMap.size} entries (removed entries not from THIS execution)`);
    console.log(`[Workflow] 🧹 Removed ${originalSize - threadInfoMap.size} STALE entries that could cause replies to old threads!`);
  }
  
  // CRITICAL VALIDATION: If threadInfoMap has entries but executedBlockIds is empty or very small,
  // this is suspicious - we might have stale data
  if (threadInfoMap.size > 0 && executedBlockIds.length === 0) {
    console.error(`[Workflow] ❌❌❌ CRITICAL WARNING: threadInfoMap has ${threadInfoMap.size} entries but executedBlockIds is EMPTY!`);
    console.error(`[Workflow] ❌ This means we have threadInfoMap entries WITHOUT execution tracking - CLEARING THEM!`);
    threadInfoMap.clear();
    console.error(`[Workflow] ❌ Cleared ALL threadInfoMap entries to prevent replies to old threads`);
  }

  // Execute the current block based on type
  console.log(`[Workflow] ========== EXECUTING BLOCK ==========`);
  console.log(`[Workflow] Block ID: ${currentBlock.id}`);
  console.log(`[Workflow] Block type: ${currentBlock.type}`);
  console.log(`[Workflow] Block title: ${currentBlock.title}`);
  console.log(`[Workflow] Block connections: ${JSON.stringify(currentBlock.connections || [])}`);
  console.log(`[Workflow] Block config: ${JSON.stringify(currentBlock.config || {})}`);
  console.log(`[Workflow] ====================================`);

  // Handle delay block BEFORE switch (needs to advance to next block before scheduling)
  // SIMPLIFIED: Copy sourcing pattern - capture threadInfoMap BEFORE delay, use it AFTER
  if (currentBlock.type === 'delay') {
    const seconds = currentBlock.config?.delaySeconds || 0;
    const minutes = currentBlock.config?.delayMinutes || 0;
    const hours = currentBlock.config?.delayHours || 0;
    const days = currentBlock.config?.delayDays || 0;
    
    console.log(`[Workflow] ⏳ Delay block: ${days}d ${hours}h ${minutes}m ${seconds}s`);
    
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

  // Handle end block
  if (currentBlock.type === 'end') {
    await updateExecutionState(supabase, execution.id, {
      status: 'completed',
    });
    
    await supabase
      .from('company_cadences')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', execution.company_cadence_id);

    return;
  }

  // Handle conditional blocks
  if (currentBlock.type === 'conditional') {
    // Condition evaluation is handled by API route
    return;
  }

  switch (currentBlock.type) {
    case 'email': {
      console.log(`[Workflow] 📧 EMAIL BLOCK STARTING EXECUTION`);
      const { sendEmail } = await import('@/lib/services/gmail-direct');
      
      if (!companyEmail) {
        console.error(`[Workflow] ❌ No email address found for company ${companyId}`);
        throw new Error(`No email address found for company ${companyId}. Please set the company email address first.`);
      }

      console.log(`[Workflow] 📧 Sending email to ${companyEmail}`);
      console.log(`[Workflow] 📧 Subject: ${currentBlock.config?.subject || '(empty)'}`);
      console.log(`[Workflow] 📧 Body length: ${(currentBlock.config?.body || '').length} characters`);
      console.log(`[Workflow] 📧 Full config:`, JSON.stringify(currentBlock.config, null, 2));
      
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
            currentBlock.config = { ...currentBlock.config, subject: originalSubject };
            console.log(`[Workflow]   Subject locked to FIRST email's subject: "${originalSubject}"`);
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
        console.log(`[Workflow]   To: ${companyEmail}`);
        console.log(`[Workflow]   Subject: "${currentBlock.config?.subject || ''}"`);
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
        
        const result = await sendEmail(user.id, {
          to: companyEmail,
          subject: currentBlock.config?.subject || '',
          body: currentBlock.config?.body || '',
          threadId,
          messageId,
        }, supabase);

        console.log(`[Workflow] ✅ Email sent successfully.`);
        console.log(`[Workflow]   Returned Thread ID: ${result.threadId}`);
        console.log(`[Workflow]   Returned Message ID: ${result.messageId}`);
        
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
            to_email: companyEmail,
            sent_at: new Date().toISOString(),
          });

        if (logError) {
          console.error(`[Workflow] Error logging email:`, logError);
        } else {
          console.log(`[Workflow] Email logged successfully`);
        }
      } catch (emailError: any) {
        console.error(`[Workflow] ❌ ERROR SENDING EMAIL:`, emailError);
        console.error(`[Workflow] ❌ Error message:`, emailError.message);
        console.error(`[Workflow] ❌ Error stack:`, emailError.stack);
        throw new Error(`Failed to send email: ${emailError.message || String(emailError)}`);
      }

      console.log(`[Workflow] 📧 EMAIL BLOCK COMPLETED SUCCESSFULLY`);
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

    case 'calendar': {
      const { createCalendarEvent } = await import('@/lib/services/calendar');
      
      if (!companyEmail) {
        console.error(`[Workflow] ❌ No email address found for company ${companyId}`);
        throw new Error(`No email address found for company ${companyId}. Please set the company email address first.`);
      }

      if (!currentBlock.config?.calendarTitle) {
        console.error(`[Workflow] ❌ Calendar block missing title`);
        throw new Error(`Calendar block is missing title. Please configure the calendar block in the cadence editor.`);
      }

      console.log(`[Workflow] 📅 Creating calendar invite for ${companyEmail}`);
      console.log(`[Workflow] 📅 Title: ${currentBlock.config.calendarTitle}`);
      console.log(`[Workflow] 📅 Duration: ${currentBlock.config.duration || 30} minutes`);
      
      try {
        const result = await createCalendarEvent(user.id, {
          toEmail: companyEmail,
          title: currentBlock.config.calendarTitle,
          description: currentBlock.config?.calendarDescription || '',
          durationMinutes: currentBlock.config?.duration || 30,
          timeConstraint: currentBlock.config?.timeConstraint || 'business_hours',
          checkAvailability: currentBlock.config?.checkAvailability !== false,
        }, supabase);

        console.log(`[Workflow] ✅ Calendar invite created! Event ID: ${result.eventId}`);

        // Log calendar invite
        await supabase
          .from('company_content')
          .insert({
            company_id: companyId,
            content_type: 'outreach_log',
            content: `Calendar invite sent: ${currentBlock.config.calendarTitle}`,
            source: 'CRM Cadence',
            metadata: {
              cadence_id: cadenceId,
              calendar_event_id: result.eventId,
            },
          });
      } catch (calendarError: any) {
        console.error(`[Workflow] ❌ Error creating calendar invite:`, calendarError.message);
        throw new Error(`Failed to create calendar invite: ${calendarError.message}`);
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
  
  console.log(`[Workflow] 📝 Updated executedBlockIds (end of block):`, updatedExecutedBlockIds);

  // Determine next block based on current block type
  // Note: conditional, delay, and end blocks already returned above
  let nextBlockId: string | null = null;

  console.log(`[Workflow] 🔍 Determining next block after ${currentBlock.type} block (${currentBlock.id})`);
  console.log(`[Workflow] 🔍 Current block connections:`, JSON.stringify(currentBlock.connections || []));

  if (currentBlock.type === 'trigger') {
    // Follow first connection
    console.log(`[Workflow] Trigger block found, checking connections...`);
    console.log(`[Workflow] Trigger connections: ${JSON.stringify(currentBlock.connections || [])}`);
    if (currentBlock.connections && currentBlock.connections.length > 0) {
      nextBlockId = currentBlock.connections[0];
      console.log(`[Workflow] ✅ Found next block after trigger: ${nextBlockId}`);
    } else {
      console.error(`[Workflow] ❌ Trigger block has no connections!`);
    }
  } else {
    // Regular blocks (email, calendar, voicecall) follow their connection
    if (currentBlock.connections && currentBlock.connections.length > 0) {
      nextBlockId = currentBlock.connections[0];
      console.log(`[Workflow] ✅ Found next block after ${currentBlock.type}: ${nextBlockId}`);
    } else {
      console.log(`[Workflow] ⚠️ ${currentBlock.type} block has no connections`);
    }
  }

  if (nextBlockId) {
    console.log(`[Workflow] 🔄 Moving to next block: ${nextBlockId}`);
    const nextBlock = blocks.find(b => b.id === nextBlockId);
    
    if (!nextBlock) {
      console.error(`[Workflow] ❌ Next block ${nextBlockId} NOT FOUND in blocks array!`);
      console.error(`[Workflow] Available blocks: ${blocks.map(b => b.id).join(', ')}`);
      throw new Error(`Next block ${nextBlockId} not found`);
    }
    
    console.log(`[Workflow] ✅ Found next block:`, {
      id: nextBlock.id,
      type: nextBlock.type,
      title: nextBlock.title,
    });
    
    await updateExecutionState(supabase, execution.id, {
      current_block_id: nextBlockId,
      scheduled_for: null, // Clear scheduled_for if set
      metadata: updatedMetadata,
    });
    
    console.log(`[Workflow] 📝 Updated execution state: current_block_id = ${nextBlockId}`);
    
    // Recursively execute next block
    // CRITICAL: Delay blocks MUST be executed immediately so they can set scheduled_for
    // Conditional blocks are handled by API route, so skip those
    // End blocks don't need execution
    if (nextBlock.type !== 'conditional' && nextBlock.type !== 'end') {
      const updatedExecution = await getExecution(supabase, execution.id);
      if (updatedExecution && updatedExecution.current_block_id === nextBlockId) {
        console.log(`[Workflow] 🔄 Executing next block immediately (type: ${nextBlock.type}, id: ${nextBlock.id})`);
        await executeNextBlock(supabase, updatedExecution, blocks);
      } else {
        console.log(`[Workflow] ⚠️ Skipping recursive execution - current_block_id mismatch or execution not found`);
        console.log(`[Workflow]   Expected: ${nextBlockId}, Got: ${updatedExecution?.current_block_id || 'null'}`);
      }
    } else {
      console.log(`[Workflow] ⏸️ Next block is ${nextBlock.type}, pausing execution`);
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

