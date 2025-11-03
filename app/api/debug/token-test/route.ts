import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { google } from 'googleapis';

/**
 * Test endpoint to manually check what Google returns for a token
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get user session
    const { data: session, error: sessionError } = await supabase
      .from('user_sessions')
      .select('access_token, refresh_token, scope')
      .eq('user_id', user.id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ 
        error: 'No session found',
        details: sessionError?.message 
      }, { status: 404 });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      return NextResponse.json({ error: 'Missing credentials' }, { status: 500 });
    }

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/google-callback`
    );

    // Try to get token info
    let tokenInfoResult: any = null;
    let tokenInfoError: any = null;
    
    try {
      tokenInfoResult = await oauth2Client.getTokenInfo(session.access_token);
    } catch (error: any) {
      tokenInfoError = error.message;
    }

    // Also try to refresh the token to see what Google returns
    let refreshResult: any = null;
    let refreshError: any = null;
    
    if (session.refresh_token) {
      try {
        oauth2Client.setCredentials({
          refresh_token: session.refresh_token,
        });
        const { credentials } = await oauth2Client.refreshAccessToken();
        refreshResult = {
          hasAccessToken: !!credentials.access_token,
          hasRefreshToken: !!credentials.refresh_token,
          scope: credentials.scope,
          expiryDate: credentials.expiry_date,
        };
      } catch (error: any) {
        refreshError = error.message;
      }
    }

    return NextResponse.json({
      userId: user.id,
      userEmail: user.email,
      storedScope: session.scope,
      storedScopeArray: session.scope ? session.scope.split(' ') : [],
      tokenInfo: tokenInfoResult ? {
        scope: tokenInfoResult.scope,
        scopeArray: tokenInfoResult.scope ? tokenInfoResult.scope.split(' ') : [],
        expiryDate: tokenInfoResult.expiry_date,
      } : null,
      tokenInfoError,
      refreshResult,
      refreshError,
      diagnosis: {
        storedScopeExists: !!session.scope,
        tokenInfoScopeExists: !!tokenInfoResult?.scope,
        refreshScopeExists: !!refreshResult?.scope,
        allScopesMatch: session.scope === tokenInfoResult?.scope && 
                       session.scope === refreshResult?.scope,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ 
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
}





