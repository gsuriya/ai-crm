import { google } from 'googleapis';
import { supabase } from '@/lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * DIRECT EMAIL SENDING - Like the sourcing directory does it
 * No scope checking, no complex logic - just set tokens and send
 */

export interface SendEmailParams {
  to: string;
  subject: string;
  body: string;
  threadId?: string;
  messageId?: string;
  from?: string;
}

export async function sendEmail(
  userId: string,
  params: SendEmailParams,
  supabaseClient?: SupabaseClient
): Promise<{ messageId: string; threadId: string; gmailMessageId: string }> {
  const db = supabaseClient || supabase;
  
  // Get tokens from database
  const { data: session } = await db
    .from('user_sessions')
    .select('access_token, refresh_token, email')
    .eq('user_id', userId)
    .single();

  if (!session?.access_token) {
    throw new Error('No access token found. Please authenticate with Google.');
  }

  // Create OAuth2 client - exactly like sourcing directory
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/google-callback`
  );

  // Set credentials and refresh if needed
  oauth2Client.setCredentials({
    access_token: session.access_token,
    refresh_token: session.refresh_token
  });

  // If we have a refresh token, always refresh to get fresh token
  if (session.refresh_token) {
    try {
      console.log('[Email] Refreshing access token...');
      const { credentials } = await oauth2Client.refreshAccessToken();
      
      // Update database with new token
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
        console.log('[Email] ✅ Token refreshed successfully');
      }
    } catch (refreshError: any) {
      console.error('[Email] ❌ Token refresh failed:', refreshError.message);
      // Continue with existing token - might still work
    }
  }

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  // Convert plain text body to HTML - preserve line breaks and spacing
  const convertTextToHtml = (text: string): string => {
    // Escape HTML characters first
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    
    // Normalize line endings
    let normalized = escaped.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Split into paragraphs (double newlines or more)
    const paragraphs = normalized.split(/\n\n+/);
    
    // Convert each paragraph: single newlines become <br>, then wrap in <p>
    const htmlParagraphs = paragraphs
      .map(para => para.trim())
      .filter(para => para.length > 0)
      .map(para => `<p>${para.replace(/\n/g, '<br>')}</p>`);
    
    // Join paragraphs with line breaks for readability
    return htmlParagraphs.join('\n') || '<p></p>';
  };

  // Build email exactly like sourcing directory
  const fromEmail = params.from || session.email || '';
  const utf8Subject = `=?utf-8?B?${Buffer.from(params.subject).toString('base64')}?=`;
  
  // Convert body to HTML if it looks like plain text
  const htmlBody = params.body.includes('<') && params.body.includes('>') 
    ? params.body // Already HTML
    : convertTextToHtml(params.body); // Convert plain text to HTML
  
  const messageParts = [
    `From: ${fromEmail}`,
    `To: ${params.to}`,
    `Subject: ${utf8Subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8'
  ];

  // Add threading headers if replying
  if (params.messageId && params.threadId) {
    messageParts.push(`In-Reply-To: ${params.messageId}`);
    messageParts.push(`References: ${params.messageId}`);
  }

  messageParts.push('');
  messageParts.push(htmlBody);

  const message = messageParts.join('\r\n'); // CRITICAL: Use CRLF like sourcing

  // Encode message
  const encodedMessage = Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  // Send email
  const requestBody: any = { raw: encodedMessage };
  if (params.threadId) {
    requestBody.threadId = params.threadId;
  }

  try {
    console.log('[Email] 📧 Sending email to:', params.to);
    console.log('[Email] 📧 Subject:', params.subject);
    
    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: requestBody
    });

    console.log('[Email] ✅ Email sent! Gmail ID:', result.data.id);

    // Get actual Message-ID from headers
    let messageId = `<${result.data.id}@mail.gmail.com>`;
    try {
      const sentMessage = await gmail.users.messages.get({
        userId: 'me',
        id: result.data.id || ''
      });
      
      const headers = sentMessage.data.payload?.headers || [];
      const messageIdHeader = headers.find((h: any) => h.name === 'Message-ID');
      if (messageIdHeader?.value) {
        messageId = messageIdHeader.value;
        console.log('[Email] 📧 Message-ID from headers:', messageId);
      }
    } catch (error) {
      console.warn('[Email] Could not get Message-ID from headers, using fallback');
    }

    return {
      messageId,
      threadId: result.data.threadId || '',
      gmailMessageId: result.data.id || ''
    };
  } catch (error: any) {
    console.error('[Email] ❌ Error sending email:', error.message);
    console.error('[Email] ❌ Error code:', error.code);
    console.error('[Email] ❌ Error details:', error.response?.data);
    
    // If it's a scope error, user needs to re-authenticate
    if (error.code === 403 || error.message?.includes('insufficient')) {
      throw new Error(
        'Your Google account lacks permission to send emails. ' +
        'Click "Fix OAuth - Authenticate Directly with Google" button and grant ALL permissions.'
      );
    }
    
    // If token expired, need to re-authenticate
    if (error.code === 401 || error.message?.includes('invalid_grant')) {
      throw new Error(
        'Your Google token has expired. ' +
        'Click "Fix OAuth - Authenticate Directly with Google" button to refresh.'
      );
    }
    
    throw new Error(`Failed to send email: ${error.message || 'Unknown error'}`);
  }
}
