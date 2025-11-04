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

  // CRITICAL LOGGING: Log exactly what thread info we're using
  console.log('[Email] ========== EMAIL SEND REQUEST ==========');
  console.log('[Email] To:', params.to);
  console.log('[Email] Subject:', params.subject);
  console.log('[Email] Thread ID:', params.threadId || 'NEW THREAD');
  console.log('[Email] Message ID (In-Reply-To):', params.messageId || 'NONE');
  console.log('[Email] Threading mode:', params.threadId ? 'REPLY TO EXISTING THREAD' : 'NEW THREAD');
  if (params.threadId) {
    console.log('[Email] ⚠️ REPLYING TO EXISTING THREAD:', params.threadId);
    console.log('[Email] ⚠️ In-Reply-To Message-ID:', params.messageId || 'MISSING');
  }
  console.log('[Email] ========================================');

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

  // Add threading headers if replying (EXACTLY like GPT guide)
  if (params.messageId && params.threadId) {
    // Use messageId exactly as provided - it should already be in correct format from headers
    // Message-ID from Gmail headers already has angle brackets like <abc123@mail.gmail.com>
    let messageIdFormatted = params.messageId.trim();
    
    // Ensure it has angle brackets (should already have them from Gmail headers)
    if (!messageIdFormatted.startsWith('<')) {
      messageIdFormatted = `<${messageIdFormatted}>`;
    }
    if (!messageIdFormatted.endsWith('>')) {
      messageIdFormatted = messageIdFormatted.replace(/>$/, '') + '>';
    }
    
    // Add headers EXACTLY as GPT guide shows
    messageParts.push(`In-Reply-To: ${messageIdFormatted}`);
    messageParts.push(`References: ${messageIdFormatted}`);
    
    console.log('[Email] 📎 Adding threading headers (GPT guide format):', {
      threadId: params.threadId,
      messageId: messageIdFormatted,
      originalMessageId: params.messageId,
      hasAngleBrackets: messageIdFormatted.startsWith('<') && messageIdFormatted.endsWith('>')
    });
  }

  messageParts.push('');
  messageParts.push(htmlBody);

  const message = messageParts.join('\r\n'); // CRITICAL: Use CRLF like sourcing

  // Log the raw message before encoding to verify threading headers
  if (params.messageId && params.threadId) {
    console.log('[Email] 📝 Raw message before encoding (showing threading headers):');
    const threadingLines = message.split('\r\n').filter(line => 
      line.includes('In-Reply-To') || line.includes('References') || line.includes('Subject')
    );
    threadingLines.forEach(line => console.log(`[Email]   ${line}`));
  }

  // Encode message
  const encodedMessage = Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  // Send email with threadId (EXACTLY like GPT guide)
  const requestBody: any = { raw: encodedMessage };
  if (params.threadId) {
    requestBody.threadId = params.threadId;
    console.log('[Email] 🧵 Including threadId in requestBody:', params.threadId);
  } else {
    console.log('[Email] 📧 No threadId - sending as new thread');
  }

  try {
    console.log('[Email] 📧 Sending email to:', params.to);
    console.log('[Email] 📧 Subject:', params.subject);
    console.log('[Email] 📧 Request body keys:', Object.keys(requestBody));
    
    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: requestBody
    });

    console.log('[Email] ✅ Email sent! Gmail ID:', result.data.id);
    console.log('[Email] ✅ Thread ID returned:', result.data.threadId);

    // Get actual Message-ID from headers (EXACTLY like GPT guide)
    // CRITICAL: We MUST get the real Message-ID from headers, not use fallback
    // The fallback will break threading!
    let messageId = `<${result.data.id}@mail.gmail.com>`; // fallback
    let messageIdFound = false;
    
    // Retry up to 3 times with delays (Gmail sometimes needs time to process)
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await new Promise(resolve => setTimeout(resolve, attempt * 500)); // 500ms, 1s, 1.5s delays
        
        const sentMessage = await gmail.users.messages.get({
          userId: 'me',
          id: result.data.id || '',
          format: 'full' // Get full message with headers
        });
        
        console.log(`[Email] 🔍 Attempt ${attempt}/3: Fetching Message-ID from sent message...`);
        
        // Gmail API headers can be in different places depending on message structure
        let headers: any[] = [];
        
        // Try payload.headers first (for simple messages)
        if (sentMessage.data.payload?.headers) {
          headers = sentMessage.data.payload.headers;
        }
        
        // If not found, try payload.parts[].headers (for multipart messages)
        if (headers.length === 0 && sentMessage.data.payload?.parts) {
          for (const part of sentMessage.data.payload.parts) {
            if (part.headers) {
              headers = part.headers;
              break; // Use first part's headers
            }
          }
        }
        
        // Also check nested parts (some messages have parts within parts)
        if (headers.length === 0 && sentMessage.data.payload?.parts) {
          for (const part of sentMessage.data.payload.parts) {
            if (part.parts) {
              for (const nestedPart of part.parts) {
                if (nestedPart.headers) {
                  headers = nestedPart.headers;
                  break;
                }
              }
            }
          }
        }
        
        const messageIdHeader = headers.find((h: any) => 
          h.name === 'Message-ID' || h.name === 'message-id' || h.name === 'Message-Id'
        );
        if (messageIdHeader?.value) {
          messageId = messageIdHeader.value;
          messageIdFound = true;
          console.log(`[Email] ✅ Message-ID found on attempt ${attempt}:`, messageId);
          console.log('[Email] 📧 Message-ID format check:', {
            hasAngleBrackets: messageId.startsWith('<') && messageId.endsWith('>'),
            length: messageId.length,
            preview: messageId.substring(0, 50)
          });
          break; // Success!
        } else if (attempt === 3) {
          // Last attempt failed
          console.error('[Email] ❌ CRITICAL: No Message-ID header found after 3 attempts!');
          console.error('[Email] ❌ Available headers:', headers.map((h: any) => h.name).join(', '));
          console.error('[Email] ❌ Payload structure:', JSON.stringify(sentMessage.data.payload, null, 2).substring(0, 1000));
        }
      } catch (error: any) {
        if (attempt === 3) {
          console.error(`[Email] ❌ CRITICAL ERROR getting Message-ID after ${attempt} attempts:`, error.message);
          console.error('[Email] ❌ This will break threading! Using fallback.');
        } else {
          console.warn(`[Email] ⚠️ Attempt ${attempt} failed, retrying...`, error.message);
        }
      }
    }
    
    if (!messageIdFound) {
      console.error('[Email] ⚠️⚠️⚠️ USING FALLBACK Message-ID - THREADING MAY FAIL!');
      console.error('[Email] ⚠️ Fallback Message-ID:', messageId);
    }

    // CRITICAL: Use the EXACT threadId returned by Gmail (might be different from what we sent)
    const actualThreadId = result.data.threadId || '';
    console.log('[Email] 🧵 Thread ID comparison:', {
      sentThreadId: params.threadId || 'NEW',
      returnedThreadId: actualThreadId,
      match: params.threadId === actualThreadId
    });

    return {
      messageId,
      threadId: actualThreadId, // Use Gmail's actual threadId
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
