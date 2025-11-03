import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { google } from 'googleapis';

/**
 * Debug endpoint to check Google OAuth token status
 * This helps diagnose Supabase vs Google OAuth conflicts
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

    // Get tokens from database
    const { data: session, error: sessionError } = await supabase
      .from('user_sessions')
      .select('access_token, refresh_token, token_expires_at, scope, created_at, updated_at')
      .eq('user_id', user.id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({
        error: 'No Google tokens found',
        details: sessionError?.message,
        solution: 'Please re-authenticate with Google',
      }, { status: 404 });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      return NextResponse.json({
        error: 'Google OAuth not configured',
      }, { status: 500 });
    }

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      process.env.GOOGLE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/google-callback`
    );

    // Check current access token
    let currentTokenInfo: any = null;
    try {
      oauth2Client.setCredentials({
        access_token: session.access_token,
      });
      currentTokenInfo = await oauth2Client.getTokenInfo(session.access_token);
    } catch (error: any) {
      console.error('Error getting current token info:', error);
    }

    // Try to refresh token
    let refreshedTokenInfo: any = null;
    let refreshSuccess = false;
    if (session.refresh_token) {
      try {
        oauth2Client.setCredentials({
          refresh_token: session.refresh_token,
        });
        const { credentials } = await oauth2Client.refreshAccessToken();
        
        if (credentials.access_token) {
          refreshSuccess = true;
          refreshedTokenInfo = await oauth2Client.getTokenInfo(credentials.access_token);
        }
      } catch (refreshError: any) {
        console.error('Error refreshing token:', refreshError);
      }
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
      },
      database: {
        hasAccessToken: !!session.access_token,
        hasRefreshToken: !!session.refresh_token,
        storedScope: session.scope || 'NONE',
        storedScopes: session.scope ? session.scope.split(' ').filter(s => s.length > 0) : [],
        tokenExpiresAt: session.token_expires_at,
        createdAt: session.created_at,
        updatedAt: session.updated_at,
      },
      currentToken: currentTokenInfo ? {
        scopes: currentTokenInfo.scope ? currentTokenInfo.scope.split(' ').filter(s => s.length > 0) : [],
        scopeString: currentTokenInfo.scope || 'NONE',
        expiresIn: currentTokenInfo.expiry_date,
        hasGmailSend: currentTokenInfo.scope?.includes('gmail.send') || false,
      } : {
        error: 'Could not get token info',
      },
      refreshedToken: refreshedTokenInfo ? {
        scopes: refreshedTokenInfo.scope ? refreshedTokenInfo.scope.split(' ').filter(s => s.length > 0) : [],
        scopeString: refreshedTokenInfo.scope || 'NONE',
        expiresIn: refreshedTokenInfo.expiry_date,
        hasGmailSend: refreshedTokenInfo.scope?.includes('gmail.send') || false,
        refreshSuccess: true,
      } : {
        refreshSuccess: false,
        error: session.refresh_token ? 'Refresh token exists but refresh failed' : 'No refresh token available',
      },
      diagnosis: {
        storedScopeHasGmailSend: session.scope?.includes('gmail.send') || false,
        currentTokenHasGmailSend: currentTokenInfo?.scope?.includes('gmail.send') || false,
        refreshedTokenHasGmailSend: refreshedTokenInfo?.scope?.includes('gmail.send') || false,
        problem: !session.refresh_token 
          ? 'No refresh token - user needs to re-authenticate'
          : !refreshedTokenInfo?.scope?.includes('gmail.send')
          ? 'Refresh token does NOT have gmail.send scope - user needs to re-authenticate and grant ALL permissions'
          : refreshedTokenInfo?.scope?.includes('gmail.send')
          ? 'Refresh token HAS gmail.send scope - should work'
          : 'Unknown issue',
      },
    });
  } catch (error: any) {
    console.error('Error in debug endpoint:', error);
    return NextResponse.json({
      error: error.message || 'Unknown error',
    }, { status: 500 });
  }
}

