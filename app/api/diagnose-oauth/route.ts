import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { google } from 'googleapis';

/**
 * CRITICAL DIAGNOSTIC: Check if Google OAuth is configured correctly
 * This will tell us exactly what's wrong
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get tokens from database
    const { data: session } = await supabase
      .from('user_sessions')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!session) {
      return NextResponse.json({
        problem: 'NO_TOKENS',
        message: 'No Google tokens found in database. Please sign in with Google.',
        solution: 'Click "Re-authenticate with Google" and grant ALL permissions.',
      });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      return NextResponse.json({
        problem: 'NO_CREDENTIALS',
        message: 'Google OAuth credentials not configured in environment variables.',
      });
    }

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/google-callback`
    );

    // Try to refresh token and see what Google returns
    let refreshResult: any = null;
    if (session.refresh_token) {
      try {
        oauth2Client.setCredentials({ refresh_token: session.refresh_token });
        const { credentials } = await oauth2Client.refreshAccessToken();
        
        if (credentials.access_token) {
          const tokenInfo = await oauth2Client.getTokenInfo(credentials.access_token);
          refreshResult = {
            success: true,
            scopes: tokenInfo.scope ? tokenInfo.scope.split(' ').filter(s => s.length > 0) : [],
            hasGmailSend: tokenInfo.scope?.includes('gmail.send') || false,
            rawScope: tokenInfo.scope || 'NONE',
          };
        }
      } catch (error: any) {
        refreshResult = {
          success: false,
          error: error.message,
          code: error.code,
          isInvalidGrant: error.message?.includes('invalid_grant') || false,
        };
      }
    }

    // Check stored scope
    const storedScopes = session.scope ? session.scope.split(' ').filter(s => s.length > 0) : [];
    const storedHasGmailSend = session.scope?.includes('gmail.send') || false;

    // Determine the problem
    let problem = 'UNKNOWN';
    let message = '';
    let solution = '';

    if (!session.refresh_token) {
      problem = 'NO_REFRESH_TOKEN';
      message = 'No refresh token found. You need to re-authenticate.';
      solution = 'Sign out completely, then sign back in with Google and grant ALL permissions.';
    } else if (refreshResult?.success === false && refreshResult.isInvalidGrant) {
      problem = 'REFRESH_TOKEN_INVALID';
      message = 'Refresh token is invalid or expired.';
      solution = 'Go to https://myaccount.google.com/permissions, revoke this app\'s access, then re-authenticate.';
    } else if (refreshResult?.success && !refreshResult.hasGmailSend) {
      problem = 'REFRESH_TOKEN_NO_SCOPES';
      message = 'Refresh token exists but does NOT have gmail.send scope. This is the root cause!';
      solution = 'CRITICAL: Your refresh token was created WITHOUT scopes. You MUST:\n' +
        '1. Go to https://myaccount.google.com/permissions\n' +
        '2. Find this app and REVOKE access\n' +
        '3. Sign out completely from this app\n' +
        '4. Sign back in with Google\n' +
        '5. On the consent screen, GRANT ALL permissions\n' +
        '6. Look for "Send email on your behalf" - if you don\'t see it, your app needs verification in Google Cloud Console';
    } else if (!storedHasGmailSend) {
      problem = 'STORED_SCOPE_MISSING';
      message = 'Stored scope doesn\'t include gmail.send.';
      solution = 'Re-authenticate with Google and grant ALL permissions.';
    } else if (refreshResult?.success && refreshResult.hasGmailSend) {
      problem = 'TOKENS_VALID';
      message = 'Tokens are valid and have gmail.send scope. Email sending should work.';
      solution = 'If email sending still fails, check server logs for the actual error.';
    }

    return NextResponse.json({
      problem,
      message,
      solution,
      details: {
        hasRefreshToken: !!session.refresh_token,
        storedScopes,
        storedHasGmailSend,
        refreshResult,
        googleCloudConsole: {
          checkOAuthConsentScreen: 'https://console.cloud.google.com/apis/credentials/consent',
          checkScopes: 'Make sure gmail.send scope is added to OAuth consent screen',
          checkTestUsers: 'If app is in Testing mode, add yourself as a test user',
          checkAppVerification: 'Sensitive scopes like gmail.send may require app verification',
        },
      },
    });
  } catch (error: any) {
    return NextResponse.json({
      problem: 'ERROR',
      message: error.message,
      solution: 'Check server logs for details.',
    }, { status: 500 });
  }
}

