import { google } from 'googleapis';
import { supabase } from '@/lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface GmailCredentials {
  access_token: string;
  refresh_token?: string;
  token_expires_at?: Date;
  scope?: string;
}

/**
 * Get authenticated Gmail client using OAuth tokens from user_sessions table
 */
export async function getGmailClient(
  userId: string, 
  supabaseClient?: SupabaseClient
): Promise<typeof google.gmail> {
  // Use provided client or fall back to default client-side instance
  const db = supabaseClient || supabase;
  
  // Get user session with OAuth tokens
  const { data: session, error } = await db
    .from('user_sessions')
    .select('access_token, refresh_token, token_expires_at, scope')
    .eq('user_id', userId)
    .single();

  if (error || !session) {
    console.error(`[Gmail] Failed to get user session for userId ${userId}:`, error);
    console.error(`[Gmail] Session data:`, session);
    throw new Error(`Failed to get user session: ${error?.message || 'Session not found'}`);
  }

  if (!session.access_token) {
    throw new Error('User session found but access_token is missing');
  }

  // Create OAuth2 client
  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    console.error('[Gmail] Missing Google OAuth credentials:', { 
      hasClientId: !!clientId, 
      hasClientSecret: !!clientSecret,
      envKeys: Object.keys(process.env).filter(k => k.includes('GOOGLE'))
    });
    throw new Error('Google OAuth credentials not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.');
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    process.env.GOOGLE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback`
  );

  // CRITICAL: Don't set credentials yet - we'll refresh first
  // Set initial credentials just for refresh (only refresh_token needed)
  if (session.refresh_token) {
    oauth2Client.setCredentials({
      refresh_token: session.refresh_token,
    });
  } else {
    oauth2Client.setCredentials({
      access_token: session.access_token,
      expiry_date: session.token_expires_at ? new Date(session.token_expires_at).getTime() : undefined,
    });
  }

  // CRITICAL FIX: The refresh token might not have scopes!
  // If refresh token was created without scopes, refreshing won't help
  // We need to check if the REFRESH token has scopes by trying to refresh first
  let actualScopes: string[] = [];
  let tokenVerified = false;
  
  // ALWAYS refresh first if we have a refresh token
  // This will tell us if the refresh token itself has scopes
  if (session.refresh_token) {
    console.log('[Gmail] 🔄 Attempting token refresh to check if refresh token has scopes...');
    
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      
      console.log('[Gmail] 🔍 Raw refresh response:', {
        hasAccessToken: !!credentials.access_token,
        hasRefreshToken: !!credentials.refresh_token,
        hasScope: !!credentials.scope,
        scope: credentials.scope,
        expiryDate: credentials.expiry_date,
        tokenType: credentials.token_type,
      });
      
      if (credentials.access_token) {
        // Check if credentials object has scope (Google often includes it here)
        if (credentials.scope) {
          actualScopes = credentials.scope.split(' ').filter(s => s.length > 0);
          console.log('[Gmail] ✅ Found scopes in refreshed credentials.scope:', actualScopes);
        } else {
          console.log('[Gmail] ⚠️ credentials.scope is empty, checking getTokenInfo...');
          // Try getTokenInfo on refreshed token
          try {
            const refreshedTokenInfo = await oauth2Client.getTokenInfo(credentials.access_token);
            console.log('[Gmail] 🔍 getTokenInfo response:', {
              hasScope: !!refreshedTokenInfo.scope,
              scope: refreshedTokenInfo.scope,
              expiresIn: refreshedTokenInfo.expiry_date,
            });
            
            if (refreshedTokenInfo.scope && refreshedTokenInfo.scope.trim().length > 0) {
              actualScopes = refreshedTokenInfo.scope.split(' ').filter(s => s.length > 0);
              console.log('[Gmail] ✅ Found scopes in refreshed token via getTokenInfo:', actualScopes);
            } else {
              console.error('[Gmail] ❌ Refreshed token has NO scopes from getTokenInfo!');
              console.error('[Gmail] ❌ This means the refresh token itself doesn\'t have scopes!');
            }
          } catch (tokenInfoError: any) {
            console.error('[Gmail] ❌ Could not get token info from refreshed token:', tokenInfoError.message);
          }
        }
        
        // Update session with refreshed token
        const scopeToStore = credentials.scope || actualScopes.join(' ') || session.scope;
        await db
          .from('user_sessions')
          .update({
            access_token: credentials.access_token,
            refresh_token: credentials.refresh_token || session.refresh_token,
            token_expires_at: credentials.expiry_date ? new Date(credentials.expiry_date).toISOString() : null,
            scope: scopeToStore,
          })
          .eq('user_id', userId);
        
        // CRITICAL: Set credentials with the refreshed token AND include scope
        const finalCredentials = {
          ...credentials,
          // Ensure scope is included in credentials if we have it
          scope: credentials.scope || actualScopes.join(' ') || undefined,
        };
        
        console.log('[Gmail] 🔍 Setting credentials with:', {
          hasAccessToken: !!finalCredentials.access_token,
          hasRefreshToken: !!finalCredentials.refresh_token,
          hasScope: !!finalCredentials.scope,
          scope: finalCredentials.scope,
          expiryDate: finalCredentials.expiry_date,
        });
        
        oauth2Client.setCredentials(finalCredentials);
        session.access_token = credentials.access_token;
        session.token_expires_at = credentials.expiry_date ? new Date(credentials.expiry_date).toISOString() : session.token_expires_at;
        session.scope = scopeToStore;
        
        if (actualScopes.length > 0) {
          tokenVerified = true;
          console.log('[Gmail] ✅ Token refreshed and verified with scopes:', actualScopes);
          console.log('[Gmail] ✅ OAuth2 client credentials set with scopes:', finalCredentials.scope);
        } else {
          // Refresh token doesn't have scopes - user needs to re-authenticate
          console.error('[Gmail] ❌ CRITICAL: Refresh token does NOT have scopes!');
          console.error('[Gmail] ❌ This means the refresh token was created without scopes.');
          console.error('[Gmail] ❌ User MUST re-authenticate to get a new refresh token WITH scopes.');
          
          // Use stored scope if available, but warn that it won't work
          actualScopes = session.scope ? session.scope.split(' ') : [];
          console.warn('[Gmail] ⚠️ Using stored scope as fallback:', actualScopes);
          console.warn('[Gmail] ⚠️ This will likely fail - refresh token needs to be recreated with scopes');
        }
      }
    } catch (refreshError: any) {
      console.error('[Gmail] ❌ Error refreshing token:', refreshError.message);
      
      // If refresh fails, check if it's because refresh token is invalid
      if (refreshError.message?.includes('invalid_grant') || refreshError.message?.includes('invalid')) {
        console.error('[Gmail] ❌ Refresh token is invalid or expired. User needs to re-authenticate.');
        throw new Error(
          `Refresh token is invalid or expired. This usually means:\n` +
          `1. The refresh token was created without the required scopes\n` +
          `2. OR the refresh token has been revoked\n\n` +
          `You MUST completely re-authenticate:\n` +
          `1. Sign out completely from this app\n` +
          `2. Go to https://myaccount.google.com/permissions and revoke this app's access\n` +
          `3. Sign back in with Google and grant ALL permissions\n` +
          `4. Look for "Send email on your behalf" permission specifically`
        );
      }
      
      // Fall back to checking original token
      actualScopes = session.scope ? session.scope.split(' ') : [];
    }
  } else {
    // No refresh token - check current token
    try {
      const tokenInfo = await oauth2Client.getTokenInfo(session.access_token);
      actualScopes = tokenInfo.scope ? tokenInfo.scope.split(' ') : [];
      
      console.log('[Gmail] 🔍 Token verification (no refresh token):', {
        userId,
        storedScopes: session.scope ? session.scope.split(' ') : [],
        actualScopesFromGoogle: actualScopes,
      });
      
      if (actualScopes.length > 0) {
        tokenVerified = true;
      }
    } catch (tokenInfoError: any) {
      console.warn('[Gmail] ⚠️ Could not verify token info:', tokenInfoError.message);
      actualScopes = session.scope ? session.scope.split(' ') : [];
    }
  }
  
  // Verify scope includes gmail.send
  const requiredScope = 'https://www.googleapis.com/auth/gmail.send';
  const hasRequiredScope = actualScopes.includes(requiredScope) || 
                          actualScopes.some(s => s.includes('gmail.send'));
  
  // If we still don't have scopes, but stored scope says we have gmail.send, proceed anyway
  // The API call will fail if scopes are actually missing
  if (!hasRequiredScope && session.scope?.includes('gmail.send')) {
    console.warn('[Gmail] ⚠️ getTokenInfo returned empty scopes, but stored scope has gmail.send.');
    console.warn('[Gmail] ⚠️ Refresh token likely doesn\'t have scopes - user needs to re-authenticate.');
    console.warn('[Gmail] ⚠️ Proceeding with stored scope - API call will determine if scopes are actually missing.');
    // Don't throw - let the API call determine if scopes are actually missing
  } else if (!hasRequiredScope) {
    console.error('[Gmail] ❌ Token missing required scope:', {
      required: requiredScope,
      actualScopesFromGoogle: actualScopes,
      storedScopes: session.scope ? session.scope.split(' ') : [],
      userId,
      hasRefreshToken: !!session.refresh_token,
    });
    
    throw new Error(
      `OAuth token missing required scope: ${requiredScope}\n\n` +
      `✅ Stored scopes in database: ${session.scope ? session.scope.split(' ').join(', ') : 'none'}\n` +
      `❌ Actual scopes from Google token: ${actualScopes.join(', ') || 'NONE - Token has no scopes!'}\n` +
      `${session.refresh_token ? '⚠️ Refresh token exists but refreshing returned no scopes' : '⚠️ No refresh token available'}\n\n` +
      `🔴 CRITICAL: Your refresh token was created WITHOUT the required scopes.\n` +
      `You MUST completely re-authenticate:\n` +
      `1. Sign out completely from this app\n` +
      `2. Go to https://myaccount.google.com/permissions and REVOKE this app's access\n` +
      `3. Sign back in with Google\n` +
      `4. GRANT ALL permissions on the consent screen\n` +
      `5. Look for "Send email on your behalf" permission specifically\n` +
      `6. This will create a NEW refresh token WITH scopes`
    );
  } else {
    console.log('[Gmail] ✅ Token has required scope:', requiredScope);
  }

  // Refresh token if expired (but only if we haven't already refreshed above)
  if (!tokenVerified && session.token_expires_at && new Date(session.token_expires_at) < new Date()) {
    console.log('[Gmail] 🔄 Token expired, attempting refresh...');
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      
      console.log('[Gmail] ✅ Token refreshed successfully');
      
      // CRITICAL: Verify refreshed token has scopes
      let actualScopes = session.scope; // Keep stored scope by default
      try {
        const tokenInfo = await oauth2Client.getTokenInfo(credentials.access_token || '');
        if (tokenInfo.scope) {
          actualScopes = tokenInfo.scope;
          console.log('[Gmail] 🔍 Refreshed token scopes from Google:', actualScopes.split(' '));
          
          // Check if refreshed token lost scopes
          const requiredScope = 'https://www.googleapis.com/auth/gmail.send';
          const hasRequiredScope = actualScopes.includes(requiredScope) || 
                                  actualScopes.some(s => s.includes('gmail.send'));
          
          if (!hasRequiredScope) {
            console.error('[Gmail] ❌ REFRESHED TOKEN LOST SCOPES!', {
              storedScopes: session.scope ? session.scope.split(' ') : [],
              refreshedScopes: actualScopes.split(' '),
            });
            
            // If refreshed token doesn't have scopes, refresh_token is invalid
            // User needs to re-authenticate to get a new refresh_token with scopes
            throw new Error(
              `Token refresh resulted in token without required scopes!\n\n` +
              `Original scopes: ${session.scope || 'none'}\n` +
              `Refreshed token scopes: ${actualScopes || 'NONE'}\n\n` +
              `Your refresh token doesn't have the required permissions. Please:\n` +
              `1. Sign out completely\n` +
              `2. Sign back in using "Continue with Google"\n` +
              `3. Grant ALL permissions on the consent screen`
            );
          }
        } else {
          console.warn('[Gmail] ⚠️ Refreshed token has NO scopes from Google!');
          // Don't update scope - keep the stored one and hope for the best
          // But this will likely fail on API call
        }
      } catch (tokenInfoError: any) {
        // If error is about missing scopes, re-throw it
        if (tokenInfoError.message?.includes('scopes') || tokenInfoError.message?.includes('permissions')) {
          throw tokenInfoError;
        }
        console.warn('[Gmail] Could not get scopes from refreshed token, using stored scope');
      }
      
      // Update tokens in database
      await db
        .from('user_sessions')
        .update({
          access_token: credentials.access_token,
          refresh_token: credentials.refresh_token || session.refresh_token,
          token_expires_at: credentials.expiry_date ? new Date(credentials.expiry_date).toISOString() : null,
          scope: actualScopes, // Update scope if we got it from Google
        })
        .eq('user_id', userId);

      oauth2Client.setCredentials(credentials);
      
      // Update session object for scope checking below
      session.access_token = credentials.access_token || session.access_token;
      session.token_expires_at = credentials.expiry_date ? new Date(credentials.expiry_date).toISOString() : session.token_expires_at;
      if (actualScopes) {
        session.scope = actualScopes;
      }
    } catch (refreshError: any) {
      console.error('[Gmail] ❌ Token refresh failed:', refreshError);
      
      // If error is about missing scopes, re-throw it
      if (refreshError.message?.includes('scopes') || refreshError.message?.includes('permissions')) {
        throw refreshError;
      }
      
      throw new Error(`Failed to refresh access token: ${refreshError.message || refreshError}`);
    }
  }

  // Final check before returning Gmail client
  const currentCredentials = oauth2Client.credentials;
  console.log('[Gmail] 🔍 Final OAuth2 client credentials before creating Gmail client:', {
    hasAccessToken: !!currentCredentials.access_token,
    hasRefreshToken: !!currentCredentials.refresh_token,
    hasScope: !!currentCredentials.scope,
    scope: currentCredentials.scope,
  });
  
  // CRITICAL: Verify the token actually has scopes by calling getTokenInfo one more time
  if (currentCredentials.access_token) {
    try {
      const finalTokenInfo = await oauth2Client.getTokenInfo(currentCredentials.access_token);
      const finalScopes = finalTokenInfo.scope ? finalTokenInfo.scope.split(' ') : [];
      console.log('[Gmail] 🔍 Final token verification before creating Gmail client:', {
        scopes: finalScopes,
        hasGmailSend: finalScopes.includes('https://www.googleapis.com/auth/gmail.send'),
      });
      
      if (!finalScopes.includes('https://www.googleapis.com/auth/gmail.send') && 
          !finalScopes.some(s => s.includes('gmail.send'))) {
        console.error('[Gmail] ❌ CRITICAL: Final token check shows NO gmail.send scope!');
        console.error('[Gmail] ❌ This means the access token doesn\'t have the required scope embedded.');
        throw new Error(
          `Access token does not have gmail.send scope. ` +
          `Even though refresh token has scopes, the refreshed access token doesn't. ` +
          `This usually means you need to re-authenticate to get a fresh refresh token WITH scopes.`
        );
      }
    } catch (tokenCheckError: any) {
      console.error('[Gmail] ⚠️ Could not verify final token:', tokenCheckError.message);
      // Continue anyway - let the API call determine if scopes are missing
    }
  }
  
  return google.gmail({ version: 'v1', auth: oauth2Client });
}

/**
 * Send email via Gmail API
 */
export interface SendEmailParams {
  to: string;
  subject: string;
  body: string;
  threadId?: string; // Gmail thread ID
  messageId?: string; // Previous message's Message-ID header (for threading)
  from?: string;
}

/**
 * Get Message-ID from a Gmail message
 * This is critical for proper threading - must use Message-ID from headers, not Gmail API's internal ID
 */
async function getMessageIdFromHeaders(
  gmail: typeof google.gmail,
  messageId: string
): Promise<string | null> {
  try {
    const message = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });

    const headers = message.data.payload?.headers || [];
    const messageIdHeader = headers.find((h: any) => h.name === 'Message-ID' || h.name === 'Message-Id');
    
    if (messageIdHeader?.value) {
      // Remove angle brackets if present
      return messageIdHeader.value.replace(/^<|>$/g, '');
    }

    return null;
  } catch (error) {
    console.error('Error getting Message-ID from headers:', error);
    return null;
  }
}

export async function sendEmail(
  userId: string,
  params: SendEmailParams,
  supabaseClient?: SupabaseClient
): Promise<{ messageId: string; threadId: string; gmailMessageId: string }> {
  console.log('[Gmail] 📧 sendEmail called for user:', userId);
  const gmail = await getGmailClient(userId, supabaseClient);
  console.log('[Gmail] ✅ Gmail client created successfully');
  
  // Get OAuth client for error handling (we'll need to recreate it)
  const db = supabaseClient || supabase;
  const { data: session } = await db
    .from('user_sessions')
    .select('access_token, refresh_token, token_expires_at, scope')
    .eq('user_id', userId)
    .single();

  // Get user's email address
  const profile = await gmail.users.getProfile({ userId: 'me' });
  const fromEmail = params.from || profile.data.emailAddress || '';

  // If replying to a thread, get the actual Message-ID from headers
  let inReplyToMessageId: string | null = null;
  let gmailThreadId: string | undefined = params.threadId;

  if (params.threadId && params.messageId) {
    // Use provided messageId (should be from previous email's headers)
    inReplyToMessageId = params.messageId;
  } else if (params.threadId) {
    // Get the latest message in the thread to extract its Message-ID
    try {
      const thread = await gmail.users.threads.get({
        userId: 'me',
        id: params.threadId,
        format: 'full',
      });

      const messages = thread.data.messages || [];
      if (messages.length > 0) {
        // Get the most recent message's Message-ID
        const latestMessage = messages[messages.length - 1];
        inReplyToMessageId = await getMessageIdFromHeaders(gmail, latestMessage.id || '');
        
        if (!inReplyToMessageId) {
          console.warn('Could not extract Message-ID from thread, threading may not work correctly');
        }
      }
    } catch (error) {
      console.error('Error getting thread for Message-ID:', error);
    }
  }

  // For replies, ensure subject matches exactly (Gmail requires exact match for threading)
  // If replying and subject doesn't start with "Re:", we'll add it
  let finalSubject = params.subject;
  if (inReplyToMessageId && !finalSubject.toLowerCase().startsWith('re:')) {
    // Check if we need to add "Re:" prefix
    // Actually, Gmail requires EXACT subject match, so we should keep it as-is
    // But if user wants to add Re:, we can do that
    // For now, keep subject exactly as provided
  }

  // Create email message with proper MIME format
  const emailLines = [
    `To: ${params.to}`,
    `From: ${fromEmail}`,
    `Subject: ${finalSubject}`,
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

  // Join with CRLF (critical for MIME format)
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

  // Include threadId if replying
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

    // Get the actual Message-ID from the sent message's headers for future threading
    const actualMessageId = await getMessageIdFromHeaders(gmail, gmailMessageId);

    return { 
      messageId: actualMessageId || gmailMessageId, 
      threadId,
      gmailMessageId,
    };
  } catch (sendError: any) {
    // Handle insufficient scopes error specifically
    if (sendError.code === 403 || sendError.message?.includes('insufficient authentication scopes') || sendError.message?.includes('insufficient')) {
      console.error('[Gmail] ❌ Insufficient scopes error:', {
        code: sendError.code,
        message: sendError.message,
        userId,
        response: sendError.response?.data,
        details: sendError.response?.data?.error?.message,
      });
      
      // Get current credentials from OAuth2 client
      const db = supabaseClient || supabase;
      const { data: currentSession } = await db
        .from('user_sessions')
        .select('access_token, refresh_token, scope')
        .eq('user_id', userId)
        .single();
      
      if (currentSession?.access_token) {
        try {
          const clientId = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
          const clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_SECRET;
          
          if (clientId && clientSecret) {
            const testOAuth2Client = new google.auth.OAuth2(
              clientId,
              clientSecret,
              process.env.GOOGLE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/google-callback`
            );
            
            testOAuth2Client.setCredentials({
              access_token: currentSession.access_token,
            });
            
            const tokenInfo = await testOAuth2Client.getTokenInfo(currentSession.access_token);
            const actualScopes = tokenInfo.scope ? tokenInfo.scope.split(' ') : [];
            
            console.error('[Gmail] 🔍 CRITICAL DEBUG - Current token scopes:', {
              storedScopes: currentSession.scope ? currentSession.scope.split(' ') : [],
              actualScopesFromGoogle: actualScopes,
              hasGmailSend: actualScopes.includes('https://www.googleapis.com/auth/gmail.send'),
            });
          }
        } catch (tokenInfoError: any) {
          console.error('[Gmail] Could not fetch token info for debugging:', tokenInfoError.message);
        }
      }
      
      // Try to get token info to show what scopes we actually have
      if (session?.access_token) {
        try {
          const clientId = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
          const clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_SECRET;
          
          if (clientId && clientSecret) {
            const oauth2Client = new google.auth.OAuth2(
              clientId,
              clientSecret,
              process.env.GOOGLE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback`
            );
            
            oauth2Client.setCredentials({
              access_token: session.access_token,
            });
            
            const tokenInfo = await oauth2Client.getTokenInfo(session.access_token);
            const actualScopes = tokenInfo.scope ? tokenInfo.scope.split(' ') : [];
            
            console.error('[Gmail] 🔍 Actual scopes from Google:', actualScopes);
            console.error('[Gmail] 📝 Stored scopes:', session.scope ? session.scope.split(' ') : []);
            
            // Check if refresh token exists
            const hasRefreshToken = !!session.refresh_token;
            
            throw new Error(
              `Request had insufficient authentication scopes.\n\n` +
              `✅ Stored scopes in database: ${session.scope ? session.scope.split(' ').join(', ') : 'none'}\n` +
              `❌ Actual scopes from Google token: ${actualScopes.join(', ') || 'NONE - Token has no scopes!'}\n` +
              `${hasRefreshToken ? '⚠️ Refresh token exists, but refreshing returned no scopes' : '⚠️ No refresh token available'}\n\n` +
              `🔴 ROOT CAUSE: Your refresh token was created WITHOUT the required scopes.\n` +
              `Refreshing won't help because the refresh token itself doesn't have permission.\n\n` +
              `✅ SOLUTION - You MUST completely re-authenticate:\n` +
              `1. Sign out completely from this app (click "Sign Out" in sidebar)\n` +
              `2. Go to https://myaccount.google.com/permissions\n` +
              `3. Find this app and click "Remove Access" or "Revoke"\n` +
              `4. Come back to this app and sign in with Google again\n` +
              `5. On the Google consent screen, GRANT ALL permissions\n` +
              `6. Look for "Send email on your behalf" permission specifically\n` +
              `7. This will create a NEW refresh token WITH scopes\n\n` +
              `After re-authenticating, try clicking "Restart" again.`
            );
          }
        } catch (tokenInfoError: any) {
          // If we can't get token info, still throw a helpful error
          console.error('[Gmail] Could not fetch token info:', tokenInfoError.message);
        }
      }
      
      throw new Error(
        `Request had insufficient authentication scopes. ` +
        `Your refresh token was created WITHOUT scopes. ` +
        `You MUST completely re-authenticate:\n` +
        `1. Sign out and go to https://myaccount.google.com/permissions\n` +
        `2. Revoke this app's access\n` +
        `3. Sign back in with Google and grant ALL permissions\n` +
        `Original error: ${sendError.message}`
      );
    }
    
    // Re-throw other errors as-is
    throw sendError;
  }
}

/**
 * Check if email was opened (via Gmail API - this is a simplified check)
 * Note: Gmail API doesn't directly provide open tracking, but we can check if email was replied to
 */
export async function checkEmailStatus(
  userId: string,
  threadId: string
): Promise<{ opened: boolean; replied: boolean }> {
  const gmail = await getGmailClient(userId);

  try {
    const thread = await gmail.users.threads.get({
      userId: 'me',
      id: threadId,
    });

    // Check if thread has replies (indicating email was opened and replied to)
    const messages = thread.data.messages || [];
    const hasReplies = messages.length > 1;

    // Simplified: assume opened if replied
    return {
      opened: hasReplies,
      replied: hasReplies,
    };
  } catch (error) {
    console.error('Error checking email status:', error);
    return { opened: false, replied: false };
  }
}

