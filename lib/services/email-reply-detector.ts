import { google } from 'googleapis';
import { supabase } from '@/lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Check if a thread has replies from the recipient
 * Returns true if there are messages in the thread from the recipient (not from us)
 */
export async function checkThreadForReply(
  userId: string,
  threadId: string,
  recipientEmail: string,
  supabaseClient?: SupabaseClient
): Promise<boolean> {
  const db = supabaseClient || supabase;
  
  // Get tokens from database
  const { data: session } = await db
    .from('user_sessions')
    .select('access_token, refresh_token, email')
    .eq('user_id', userId)
    .single();

  if (!session?.access_token) {
    console.error('[Reply Detector] No access token found for user:', userId);
    return false;
  }

  // Create OAuth2 client
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/google-callback`
  );

  oauth2Client.setCredentials({
    access_token: session.access_token,
    refresh_token: session.refresh_token
  });

  // Refresh token if needed
  if (session.refresh_token) {
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      if (credentials.access_token) {
        await db
          .from('user_sessions')
          .update({
            access_token: credentials.access_token,
            refresh_token: credentials.refresh_token || session.refresh_token,
            token_expires_at: credentials.expiry_date ? new Date(credentials.expiry_date).toISOString() : null,
          })
          .eq('user_id', userId);
        
        oauth2Client.setCredentials({
          access_token: credentials.access_token,
          refresh_token: credentials.refresh_token || session.refresh_token,
          expiry_date: credentials.expiry_date,
        });
      }
    } catch (refreshError: any) {
      console.error('[Reply Detector] Token refresh failed:', refreshError.message);
      // Continue with existing token
    }
  }

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  const senderEmail = session.email?.toLowerCase() || '';

  try {
    // Get the thread
    const thread = await gmail.users.threads.get({
      userId: 'me',
      id: threadId,
      format: 'full',
    });

    const messages = thread.data.messages || [];
    
    if (messages.length === 0) {
      return false;
    }

    console.log(`[Reply Detector] Thread ${threadId} has ${messages.length} message(s)`);
    console.log(`[Reply Detector] Checking for replies from ${recipientEmail.toLowerCase()} (sender: ${senderEmail})`);
    console.log(`[Reply Detector] Recipient == Sender: ${recipientEmail.toLowerCase() === senderEmail}`);

    // Simple check matching sourcing directory pattern:
    // If thread has more than 1 message, check if most recent (last in array) is from recipient
    // Gmail API returns messages in chronological order (oldest first), so last message is most recent
    if (messages.length <= 1) {
      console.log(`[Reply Detector] Thread has only ${messages.length} message(s), no replies possible`);
      return false;
    }

    // Get the most recent message (last in array)
    const mostRecentMessageObj = messages[messages.length - 1];
    
    try {
      const msg = await gmail.users.messages.get({
        userId: 'me',
        id: mostRecentMessageObj.id || '',
        format: 'full',
      });

      const headers = msg.data.payload?.headers || [];
      const fromHeader = headers.find((h: any) => h.name === 'From' || h.name === 'from');
      const fromEmail = fromHeader?.value || '';
      const inReplyToHeader = headers.find((h: any) => h.name === 'In-Reply-To' || h.name === 'in-reply-to');
      const inReplyTo = inReplyToHeader?.value || '';

      // Extract email from "Name <email@domain.com>" format
      const emailMatch = fromEmail.match(/<([^>]+)>/) || fromEmail.match(/([^\s<>]+@[^\s<>]+)/);
      const fromEmailAddress = emailMatch ? emailMatch[1].toLowerCase() : fromEmail.toLowerCase();

      console.log(`[Reply Detector] Most recent message (${mostRecentMessageObj.id}, index ${messages.length - 1}): from ${fromEmailAddress}`);
      console.log(`[Reply Detector]   isFromRecipient: ${fromEmailAddress === recipientEmail.toLowerCase()}`);
      console.log(`[Reply Detector]   isFromSender: ${fromEmailAddress === senderEmail}`);
      console.log(`[Reply Detector]   hasInReplyToHeader: ${!!inReplyTo}`);
      
      // CRITICAL: If recipient == sender, we can't distinguish by email alone
      // Instead, check if the message has In-Reply-To header (indicating it's a reply)
      // OR check if message is from recipient AND it's not the first message
      const isFromRecipient = fromEmailAddress === recipientEmail.toLowerCase();
      const isFromSender = fromEmailAddress === senderEmail;
      const isReply = !!inReplyTo; // Has In-Reply-To header means it's a reply
      
      // Case 1: Recipient != Sender (normal case)
      // Reply exists if most recent message is from recipient (not from us)
      if (recipientEmail.toLowerCase() !== senderEmail) {
        if (isFromRecipient && !isFromSender) {
          console.log(`[Reply Detector] ✅✅✅ REPLY FOUND in thread ${threadId} from ${recipientEmail} ✅✅✅`);
          console.log(`[Reply Detector] Most recent message (index ${messages.length - 1}) is from recipient (messages.length: ${messages.length})`);
          return true;
        }
      } else {
        // Case 2: Recipient == Sender (self-email case)
        // Reply exists if the most recent message has In-Reply-To header (indicating it's a reply)
        // AND it's from the recipient/sender
        // AND it's not the first message (first message is always our initial email)
        if (isReply && isFromRecipient && messages.length > 1) {
          console.log(`[Reply Detector] ✅✅✅ REPLY FOUND in thread ${threadId} (recipient == sender, In-Reply-To detected) ✅✅✅`);
          console.log(`[Reply Detector] Most recent message has In-Reply-To header: ${inReplyTo}`);
          return true;
        }
      }
      
      // Log all messages for debugging
      console.log(`[Reply Detector] All ${messages.length} messages in thread (oldest to newest):`);
      for (let i = 0; i < messages.length; i++) {
        try {
          const checkMsg = await gmail.users.messages.get({
            userId: 'me',
            id: messages[i].id || '',
            format: 'metadata',
            metadataHeaders: ['From', 'Date', 'In-Reply-To'],
          });
          const msgHeaders = checkMsg.data.payload?.headers || [];
          const msgFrom = msgHeaders.find((h: any) => h.name === 'From' || h.name === 'from')?.value || '';
          const msgFromEmail = msgFrom.match(/<([^>]+)>/)?.[1] || msgFrom.match(/([^\s<>]+@[^\s<>]+)/)?.[1] || msgFrom;
          const msgDate = msgHeaders.find((h: any) => h.name === 'Date' || h.name === 'date')?.value || '';
          const msgInReplyTo = msgHeaders.find((h: any) => h.name === 'In-Reply-To' || h.name === 'in-reply-to')?.value || '';
          const isReplyMsg = !!msgInReplyTo;
          console.log(`[Reply Detector]   [${i}] ${msgFromEmail.toLowerCase()} ${i === messages.length - 1 ? '← MOST RECENT' : ''} ${isReplyMsg ? '(REPLY)' : ''} (${msgDate})`);
        } catch (e) {
          console.log(`[Reply Detector]   [${i}] (error getting message)`);
        }
      }
    } catch (msgError) {
      console.error(`[Reply Detector] Error getting most recent message ${mostRecentMessageObj.id}:`, msgError);
      return false;
    }
    
    console.log(`[Reply Detector] No reply found in thread ${threadId} - most recent message is not from recipient or doesn't have In-Reply-To header`);

    return false;
  } catch (error: any) {
    console.error(`[Reply Detector] Error checking thread ${threadId}:`, error.message);
    return false;
  }
}

/**
 * Check for replies to cadence emails and pause cadences that have received replies
 */
export async function checkAndPauseCadencesWithReplies(
  supabaseClient?: SupabaseClient
): Promise<{ paused: number; checked: number }> {
  const db = supabaseClient || supabase;
  
  let pausedCount = 0;
  let checkedCount = 0;

  try {
    // Get all active cadence executions
    const { data: executions, error: execError } = await db
      .from('cadence_executions')
      .select('*')
      .eq('status', 'active');

    if (execError) {
      console.error('[Reply Detector] Error fetching executions:', execError);
      return { paused: 0, checked: 0 };
    }

    if (!executions || executions.length === 0) {
      return { paused: 0, checked: 0 };
    }

    // Get company_cadence associations
    const companyCadenceIds = executions.map(e => e.company_cadence_id);
    const { data: companyCadences, error: ccError } = await db
      .from('company_cadences')
      .select('id, company_id, cadence_id')
      .in('id', companyCadenceIds);

    if (ccError || !companyCadences) {
      console.error('[Reply Detector] Error fetching company cadences:', ccError);
      return { paused: 0, checked: 0 };
    }

    // Get company IDs
    const companyIds = companyCadences.map(cc => cc.company_id);
    
    // Get contacts for these companies
    const { data: contacts, error: contactsError } = await db
      .from('contacts')
      .select('company_id, email')
      .in('company_id', companyIds);

    if (contactsError) {
      console.error('[Reply Detector] Error fetching contacts:', contactsError);
      return { paused: 0, checked: 0 };
    }

    // Create map of company_id -> contact email
    const contactMap = new Map<string, string>();
    contacts?.forEach(contact => {
      if (!contactMap.has(contact.company_id)) {
        contactMap.set(contact.company_id, contact.email);
      }
    });

    // Check each execution for replies using threadInfoMap from execution metadata
    for (const execution of executions) {
      const companyCadence = companyCadences.find(cc => cc.id === execution.company_cadence_id);
      if (!companyCadence) {
        console.log(`[Reply Detector] Skipping execution ${execution.id} - company cadence not found`);
        continue;
      }

      const recipientEmail = contactMap.get(companyCadence.company_id);
      if (!recipientEmail) {
        console.log(`[Reply Detector] Skipping execution ${execution.id} - no recipient email found`);
        continue;
      }

      // Get user_id from execution metadata
      const userId = execution.metadata?.user_id;
      if (!userId) {
        console.warn(`[Reply Detector] No user_id in execution ${execution.id} metadata`);
        continue;
      }

      // Get threadInfoMap from execution metadata
      // threadInfoMap is stored as { blockId: { threadId, messageId } }
      const threadInfoMap = execution.metadata?.threadInfoMap || {};
      
      console.log(`[Reply Detector] Checking execution ${execution.id} for company ${companyCadence.company_id}, recipient: ${recipientEmail}`);
      console.log(`[Reply Detector] threadInfoMap has ${Object.keys(threadInfoMap).length} entries:`, Object.keys(threadInfoMap));
      
      // Get all thread IDs from the execution's threadInfoMap
      const threadIds = Object.values(threadInfoMap).map((info: any) => info?.threadId).filter(Boolean);
      
      if (threadIds.length === 0) {
        // No emails sent yet for this execution, skip
        console.log(`[Reply Detector] No thread IDs found for execution ${execution.id}, skipping`);
        continue;
      }

      console.log(`[Reply Detector] Found ${threadIds.length} thread(s) to check for execution ${execution.id}`);

      // Check the most recent thread (last one in the array) for replies
      // This matches sourcing directory pattern - check the most recent thread
      // Note: threadInfoMap is an object, so we'll check all threads but prioritize most recent
      const threadIdsArray = Array.from(new Set(threadIds)); // Remove duplicates
      let hasReply = false;
      
      // Check threads in reverse order (most recent first) - matching sourcing pattern
      for (let i = threadIdsArray.length - 1; i >= 0; i--) {
        const threadId = threadIdsArray[i];
        checkedCount++;
        console.log(`[Reply Detector] Checking thread ${threadId} for replies from ${recipientEmail}... (${i === threadIdsArray.length - 1 ? 'MOST RECENT' : 'older'})`);
        const replyFound = await checkThreadForReply(
          userId,
          threadId,
          recipientEmail,
          db
        );
        
        if (replyFound) {
          hasReply = true;
          console.log(`[Reply Detector] ✅✅✅ REPLY FOUND in thread ${threadId} for execution ${execution.id} ✅✅✅`);
          break; // Found a reply, no need to check other threads
        } else {
          console.log(`[Reply Detector] No reply found in thread ${threadId}`);
        }
      }

      if (hasReply) {
        // Pause the cadence execution
        await db
          .from('cadence_executions')
          .update({
            status: 'paused',
            metadata: {
              ...execution.metadata,
              paused_reason: 'email_reply_received',
              paused_at: new Date().toISOString(),
            },
          })
          .eq('id', execution.id);

        // Also update company_cadence status
        await db
          .from('company_cadences')
          .update({
            status: 'paused',
          })
          .eq('id', execution.company_cadence_id);

        pausedCount++;
        console.log(`[Reply Detector] ✅ Paused cadence execution ${execution.id} due to email reply`);
      }
    }

    return { paused: pausedCount, checked: checkedCount };
  } catch (error: any) {
    console.error('[Reply Detector] Error checking for replies:', error.message);
    return { paused: 0, checked: checkedCount };
  }
}

/**
 * Check for replies on COMPLETED cadences and update status to "responded"
 * This catches replies that come in after all emails were sent
 */
export async function checkCompletedCadencesForReplies(
  supabaseClient?: SupabaseClient
): Promise<{ responded: number; checked: number }> {
  const db = supabaseClient || supabase;
  
  let respondedCount = 0;
  let checkedCount = 0;

  try {
    // Get all completed cadence executions that haven't been marked as responded
    const { data: executions, error: execError } = await db
      .from('cadence_executions')
      .select('*')
      .eq('status', 'completed');

    if (execError) {
      console.error('[Reply Detector] Error fetching completed executions:', execError);
      return { responded: 0, checked: 0 };
    }

    if (!executions || executions.length === 0) {
      console.log('[Reply Detector] No completed executions to check');
      return { responded: 0, checked: 0 };
    }

    // Filter out already responded ones
    const uncheckedExecutions = executions.filter(
      (e: any) => !e.metadata?.responded && e.metadata?.paused_reason !== 'email_reply_received'
    );

    console.log(`[Reply Detector] Checking ${uncheckedExecutions.length} completed executions for late replies`);

    if (uncheckedExecutions.length === 0) {
      return { responded: 0, checked: 0 };
    }

    // Get company_cadence associations
    const companyCadenceIds = uncheckedExecutions.map((e: any) => e.company_cadence_id);
    const { data: companyCadences, error: ccError } = await db
      .from('company_cadences')
      .select('id, company_id, cadence_id')
      .in('id', companyCadenceIds);

    if (ccError || !companyCadences) {
      console.error('[Reply Detector] Error fetching company cadences:', ccError);
      return { responded: 0, checked: 0 };
    }

    // Get company IDs
    const companyIds = companyCadences.map((cc: any) => cc.company_id);
    
    // Get contacts for these companies
    const { data: contacts, error: contactsError } = await db
      .from('contacts')
      .select('company_id, email')
      .in('company_id', companyIds);

    if (contactsError) {
      console.error('[Reply Detector] Error fetching contacts:', contactsError);
      return { responded: 0, checked: 0 };
    }

    // Create map of company_id -> contact email
    const contactMap = new Map<string, string>();
    contacts?.forEach((contact: any) => {
      if (!contactMap.has(contact.company_id)) {
        contactMap.set(contact.company_id, contact.email);
      }
    });

    // Check each completed execution for late replies
    for (const execution of uncheckedExecutions) {
      const companyCadence = companyCadences.find((cc: any) => cc.id === execution.company_cadence_id);
      if (!companyCadence) continue;

      const recipientEmail = contactMap.get(companyCadence.company_id);
      if (!recipientEmail) continue;

      const userId = execution.metadata?.user_id;
      if (!userId) continue;

      const threadInfoMap = execution.metadata?.threadInfoMap || {};
      const threadIds = Object.values(threadInfoMap).map((info: any) => info?.threadId).filter(Boolean);
      
      if (threadIds.length === 0) continue;

      console.log(`[Reply Detector] Checking completed execution ${execution.id} for late replies...`);

      const threadIdsArray = Array.from(new Set(threadIds)) as string[];
      let hasReply = false;
      
      for (let i = threadIdsArray.length - 1; i >= 0; i--) {
        const threadId = threadIdsArray[i];
        checkedCount++;
        const replyFound = await checkThreadForReply(userId, threadId, recipientEmail, db);
        
        if (replyFound) {
          hasReply = true;
          console.log(`[Reply Detector] Late reply found for completed execution ${execution.id}`);
          break;
        }
      }

      if (hasReply) {
        // Update the execution to mark as responded
        await db
          .from('cadence_executions')
          .update({
            status: 'paused', // Use paused status with responded reason
            metadata: {
              ...execution.metadata,
              responded: true,
              paused_reason: 'email_reply_received',
              responded_at: new Date().toISOString(),
            },
          })
          .eq('id', execution.id);

        // Update company_cadence status
        await db
          .from('company_cadences')
          .update({ status: 'paused' })
          .eq('id', execution.company_cadence_id);

        respondedCount++;
        console.log(`[Reply Detector] Marked execution ${execution.id} as responded`);
      }
    }

    return { responded: respondedCount, checked: checkedCount };
  } catch (error: any) {
    console.error('[Reply Detector] Error checking completed cadences:', error.message);
    return { responded: 0, checked: checkedCount };
  }
}
