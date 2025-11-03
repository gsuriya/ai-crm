import { google } from 'googleapis';
import { supabase } from '@/lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * SIMPLE EMAIL SENDING - Clean Implementation
 * 
 * This version:
 * 1. Gets tokens from user_sessions table
 * 2. Always refreshes the token to ensure it's fresh
 * 3. Uses the refreshed token to send email
 * 4. No complex scope checking - just trust Google's API errors
 */

export interface SendEmailParams {
  to: string;
  subject: string;
  body: string;
  threadId?: string;
  messageId?: string;
  from?: string;
}

/**
 * Get a fresh OAuth2 client with valid tokens
 */
async function getFreshOAuthClient(
  userId: string,
  supabaseClient?: SupabaseClient
): Promise<google.auth.OAuth2Client> {
  const db = supabaseClient || supabase;
  
  // Get user session
  const { data: session, error } = await db
    .from('user_sessions')
    .select('access_token, refresh_token, token_expires_at')
    .eq('user_id', userId)
    .single();

  if (error || !session) {
    throw new Error(`Failed to get user session: ${error?.message || 'Session not found'}`);
  }

  if (!session.access_token) {
    throw new Error('User session found but access_token is missing');
  }

  // Get OAuth credentials
  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials not configured');
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    process.env.GOOGLE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/google-callback`
  );

  // Always refresh the token to ensure it's fresh and has scopes
  if (session.refresh_token) {
    oauth2Client.setCredentials({
      refresh_token: session.refresh_token,
    });

    try {
      console.log('[Email] Refreshing access token...');
      const { credentials } = await oauth2Client.refreshAccessToken();
      
      // Update session with refreshed token
      await db
        .from('user_sessions')
        .update({
          access_token: credentials.access_token,
          refresh_token: credentials.refresh_token || session.refresh_token,
          token_expires_at: credentials.expiry_date ? new Date(credentials.expiry_date).toISOString() : null,
        })
        .eq('user_id', userId);

      // Set refreshed credentials
      oauth2Client.setCredentials({
        access_token: credentials.access_token,
        refresh_token: credentials.refresh_token || session.refresh_token,
        expiry_date: credentials.expiry_date,
      });

      console.log('[Email] ✅ Token refreshed successfully');
    } catch (refreshError: any) {
      console.error('[Email] ❌ Token refresh failed:', refreshError.message);
      throw new Error(
        `Failed to refresh token: ${refreshError.message}. ` +
        `Please sign out and sign back in with Google, making sure to grant ALL permissions.`
      );
    }
  } else {
    // No refresh token - use existing access token
    oauth2Client.setCredentials({
      access_token: session.access_token,
      expiry_date: session.token_expires_at ? new Date(session.token_expires_at).getTime() : undefined,
    });
  }

  return oauth2Client;
}

/**
 * Send email via Gmail API - Simple version
 */
export async function sendEmail(
  userId: string,
  params: SendEmailParams,
  supabaseClient?: SupabaseClient
): Promise<{ messageId: string; threadId: string; gmailMessageId: string }> {
  console.log('[Email] 📧 Sending email to:', params.to);

  // Get fresh OAuth client
  const oauth2Client = await getFreshOAuthClient(userId, supabaseClient);
  
  // Create Gmail client
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  // Get user's email address
  const profile = await gmail.users.getProfile({ userId: 'me' });
  const fromEmail = params.from || profile.data.emailAddress || '';

  // Handle threading
  let inReplyToMessageId: string | null = null;
  let gmailThreadId: string | undefined = params.threadId;

  if (params.threadId && params.messageId) {
    inReplyToMessageId = params.messageId;
  } else if (params.threadId) {
    // Get Message-ID from thread
    try {
      const thread = await gmail.users.threads.get({
        userId: 'me',
        id: params.threadId,
        format: 'full',
      });

      const messages = thread.data.messages || [];
      if (messages.length > 0) {
        const latestMessage = messages[messages.length - 1];
        const message = await gmail.users.messages.get({
          userId: 'me',
          id: latestMessage.id || '',
          format: 'full',
        });

        const headers = message.data.payload?.headers || [];
        const messageIdHeader = headers.find((h: any) => h.name === 'Message-ID' || h.name === 'Message-Id');
        if (messageIdHeader?.value) {
          inReplyToMessageId = messageIdHeader.value.replace(/^<|>$/g, '');
        }
      }
    } catch (error) {
      console.warn('[Email] Could not get Message-ID from thread:', error);
    }
  }

  // Build email message
  const emailLines = [
    `To: ${params.to}`,
    `From: ${fromEmail}`,
    `Subject: ${params.subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=utf-8`,
  ];

  // Add threading headers if replying
  if (inReplyToMessageId && gmailThreadId) {
    emailLines.push(`In-Reply-To: <${inReplyToMessageId}>`);
    emailLines.push(`References: <${inReplyToMessageId}>`);
  }

  emailLines.push(''); // Empty line before body
  emailLines.push(params.body);

  // Encode email
  const rawEmail = emailLines.join('\r\n');
  const encodedEmail = Buffer.from(rawEmail)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  // Send email
  const sendBody: any = {
    raw: encodedEmail,
  };

  if (gmailThreadId) {
    sendBody.threadId = gmailThreadId;
  }

  try {
    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: sendBody,
    });

    const gmailMessageId = response.data.id || '';
    const threadId = response.data.threadId || gmailThreadId || '';

    // Get Message-ID from sent message
    let actualMessageId: string | null = null;
    try {
      const sentMessage = await gmail.users.messages.get({
        userId: 'me',
        id: gmailMessageId,
        format: 'full',
      });

      const headers = sentMessage.data.payload?.headers || [];
      const messageIdHeader = headers.find((h: any) => h.name === 'Message-ID' || h.name === 'Message-Id');
      if (messageIdHeader?.value) {
        actualMessageId = messageIdHeader.value.replace(/^<|>$/g, '');
      }
    } catch (error) {
      console.warn('[Email] Could not get Message-ID from sent message:', error);
    }

    console.log('[Email] ✅ Email sent successfully!', {
      messageId: actualMessageId || gmailMessageId,
      threadId,
    });

    return { 
      messageId: actualMessageId || gmailMessageId, 
      threadId,
      gmailMessageId,
    };
  } catch (sendError: any) {
    console.error('[Email] ❌ Error sending email:', sendError.message);
    
    // Handle scope errors with helpful message
    if (sendError.code === 403 || sendError.message?.includes('insufficient authentication scopes')) {
      throw new Error(
        `Email sending failed: Your Google account doesn't have permission to send emails. ` +
        `Please sign out and sign back in with Google, making sure to grant ALL permissions, ` +
        `especially "Send email on your behalf". Original error: ${sendError.message}`
      );
    }
    
    throw new Error(`Failed to send email: ${sendError.message}`);
  }
}

