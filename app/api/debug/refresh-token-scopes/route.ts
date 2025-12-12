import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { google } from 'googleapis';

/**
 * Debug endpoint to check what Google actually returns when refreshing the token
 * This will show if the refresh token has scopes or not
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Get user session with OAuth tokens
    const { data: session, error: sessionError } = await supabase
      .from('user_sessions')
      .select('access_token, refresh_token, token_expires_at, scope')
      .eq('user_id', user.id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'User session not found', details: sessionError?.message },
        { status: 404 }
      );
    }

    // Create OAuth2 client
    const clientId = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: 'Google OAuth credentials not configured' },
        { status: 500 }
      );
    }

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      process.env.GOOGLE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/google-callback`
    );

    const result: any = {
      userId: user.id,
      userEmail: user.email,
      storedScopes: session.scope ? session.scope.split(' ') : [],
      hasRefreshToken: !!session.refresh_token,
    };

    // Check current token
    try {
      const tokenInfo = await oauth2Client.getTokenInfo(session.access_token);
      result.currentTokenScopes = (tokenInfo as any).scope ? (tokenInfo as any).scope.split(' ') : [];
      result.currentTokenExpiresAt = tokenInfo.expiry_date ? new Date(tokenInfo.expiry_date).toISOString() : null;
    } catch (error: any) {
      result.currentTokenError = error.message;
    }

    // CRITICAL: Try to refresh the token and see what Google returns
    if (session.refresh_token) {
      oauth2Client.setCredentials({
        refresh_token: session.refresh_token,
      });

      try {
        const { credentials } = await oauth2Client.refreshAccessToken();
        
        result.refreshSuccessful = true;
        result.refreshedTokenHasScope = !!credentials.scope;
        result.refreshedTokenScopes = credentials.scope ? credentials.scope.split(' ') : [];
        
        // If credentials.scope is empty, try getTokenInfo on the refreshed token
        if (!credentials.scope && credentials.access_token) {
          try {
            const refreshedTokenInfo = await oauth2Client.getTokenInfo(credentials.access_token);
            result.refreshedTokenInfoScopes = (refreshedTokenInfo as any).scope ? (refreshedTokenInfo as any).scope.split(' ') : [];
            
            if ((refreshedTokenInfo as any).scope) {
              result.refreshedTokenScopes = (refreshedTokenInfo as any).scope.split(' ');
              result.refreshedTokenHasScope = true;
            }
          } catch (tokenInfoError: any) {
            result.refreshedTokenInfoError = tokenInfoError.message;
          }
        }
        
        result.refreshedTokenExpiresAt = credentials.expiry_date ? new Date(credentials.expiry_date).toISOString() : null;
        
        // Check if gmail.send is present
        const allRefreshedScopes = result.refreshedTokenScopes || [];
        result.hasGmailSendAfterRefresh = allRefreshedScopes.includes('https://www.googleapis.com/auth/gmail.send') || 
                                          allRefreshedScopes.some((s: string) => s.includes('gmail.send'));
        
        result.verdict = result.hasGmailSendAfterRefresh 
          ? '✅ Refresh token HAS scopes - should work!'
          : '❌ Refresh token does NOT have scopes - you need to re-authenticate!';
        
      } catch (refreshError: any) {
        result.refreshError = refreshError.message;
        result.refreshSuccessful = false;
        result.verdict = `❌ Refresh failed: ${refreshError.message}`;
      }
    } else {
      result.verdict = '⚠️ No refresh token available';
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error('Error checking refresh token scopes:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check refresh token scopes' },
      { status: 500 }
    );
  }
}

