import { google } from 'googleapis';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * STANDALONE GOOGLE OAUTH - Completely bypasses Supabase OAuth
 * 
 * This version:
 * 1. Gets tokens directly from database (stored separately from Supabase auth)
 * 2. Always refreshes before use
 * 3. No Supabase OAuth interference
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
 * Get Google OAuth tokens directly from database
 * This bypasses Supabase's OAuth entirely
 */
async function getGoogleTokens(
  userId: string,
  supabaseClient?: SupabaseClient
): Promise<{
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
}> {
  const db = supabaseClient || await createServerSupabaseClient();
  
  const { data: session, error } = await db
    .from('user_sessions')
    .select('access_token, refresh_token, token_expires_at')
    .eq('user_id', userId)
    .single();

  if (error || !session) {
    throw new Error(`Failed to get Google tokens: ${error?.message || 'Session not found'}`);
  }

  if (!session.access_token) {
    throw new Error('No Google access token found. Please re-authenticate with Google.');
  }

  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.token_expires_at,
  };
}

/**
 * Create OAuth2 client with fresh tokens
 */
async function getOAuth2Client(
  userId: string,
  supabaseClient?: SupabaseClient
): Promise<google.auth.OAuth2Client> {
  const tokens = await getGoogleTokens(userId, supabaseClient);

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

  // Always refresh to get fresh token
  if (tokens.refresh_token) {
    oauth2Client.setCredentials({
      refresh_token: tokens.refresh_token,
    });

    try {
      console.log('[Email] Refreshing Google access token...');
      const { credentials } = await oauth2Client.refreshAccessToken();
      
      if (!credentials.access_token) {
        throw new Error('No access token returned from refresh');
      }

      // Update database with new token
      const db = supabaseClient || await createServerSupabaseClient();
      await db
        .from('user_sessions')
        .update({
          access_token: credentials.access_token,
          refresh_token: credentials.refresh_token || tokens.refresh_token,
          token_expires_at: credentials.expiry_date ? new Date(credentials.expiry_date).toISOString() : null,
        })
        .eq('user_id', userId);

      // Set fresh credentials
      oauth2Client.setCredentials({
        access_token: credentials.access_token,
        refresh_token: credentials.refresh_token || tokens.refresh_token,
        expiry_date: credentials.expiry_date,
      });

      console.log('[Email] ✅ Token refreshed successfully');
    } catch (refreshError: any) {
      console.error('[Email] ❌ Token refresh failed:', refreshError.message);
      
      // Check if it's a scope error
      if (refreshError.message?.includes('invalid_grant') || 
          refreshError.message?.includes('invalid') ||
          refreshError.code === 401) {
        throw new Error(
          'Your Google refresh token is invalid or expired. ' +
          'This usually means:\n' +
          '1. The refresh token was created without the required scopes\n' +
          '2. OR the token was revoked\n\n' +
          'Please sign out completely and re-authenticate with Google, ' +
          'making sure to grant ALL permissions including "Send email on your behalf".'
        );
      }
      
      throw new Error(`Failed to refresh token: ${refreshError.message}`);
    }
  } else {
    // No refresh token - use existing access token
    oauth2Client.setCredentials({
      access_token: tokens.access_token,
      expiry_date: tokens.expires_at ? new Date(tokens.expires_at).getTime() : undefined,
    });
  }

  return oauth2Client;
}

/**
 * Send email via Gmail API - Standalone version
 */
export async function sendEmail(
  userId: string,
  params: SendEmailParams,
  supabaseClient?: SupabaseClient
): Promise<{ messageId: string; threadId: string; gmailMessageId: string }> {
  console.log('[Email] 📧 Sending email to:', params.to);

  // Get OAuth client (will refresh token automatically)
  const oauth2Client = await getOAuth2Client(userId, supabaseClient);
  
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
    console.error('[Email] ❌ Error details:', {
      code: sendError.code,
      message: sendError.message,
      response: sendError.response?.data,
    });
    
    // Handle scope errors
    if (sendError.code === 403 || 
        sendError.message?.includes('insufficient authentication scopes') ||
        sendError.message?.includes('insufficient')) {
      throw new Error(
        '❌ Email sending failed: Your Google account doesn\'t have permission to send emails.\n\n' +
        '🔴 ROOT CAUSE: Your refresh token was created WITHOUT the required scopes.\n\n' +
        '✅ SOLUTION:\n' +
        '1. Sign out completely from this app\n' +
        '2. Go to https://myaccount.google.com/permissions\n' +
        '3. Find this app and click "Remove Access" or "Revoke"\n' +
        '4. Come back and click "Re-authenticate with Google"\n' +
        '5. On the Google consent screen, GRANT ALL permissions\n' +
        '6. Look for "Send email on your behalf" permission specifically\n\n' +
        'Original error: ' + sendError.message
      );
    }
    
    throw new Error(`Failed to send email: ${sendError.message}`);
  }
}

