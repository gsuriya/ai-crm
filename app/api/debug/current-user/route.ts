import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { google } from 'googleapis';

/**
 * Debug endpoint to check current user's tokens and scopes
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({
        error: 'Not authenticated',
        details: authError?.message,
      }, { status: 401 });
    }

    // Get user session tokens
    const { data: session, error: sessionError } = await supabase
      .from('user_sessions')
      .select('access_token, refresh_token, token_expires_at, scope, email')
      .eq('user_id', user.id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({
        userId: user.id,
        userEmail: user.email,
        sessionError: sessionError?.message,
        hasSession: false,
      });
    }

    // Get actual scopes from Google
    let actualScopes: string[] = [];
    let tokenInfoError: string | null = null;
    
    if (session.access_token) {
      try {
        const clientId = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_SECRET;
        
        if (clientId && clientSecret) {
          const oauth2Client = new google.auth.OAuth2(
            clientId,
            clientSecret,
            `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback`
          );
          
          oauth2Client.setCredentials({
            access_token: session.access_token,
          });
          
          const tokenInfo = await oauth2Client.getTokenInfo(session.access_token);
          actualScopes = tokenInfo.scope ? tokenInfo.scope.split(' ') : [];
        }
      } catch (error: any) {
        tokenInfoError = error.message;
      }
    }

    const hasGmailSend = actualScopes.includes('https://www.googleapis.com/auth/gmail.send');

    return NextResponse.json({
      userId: user.id,
      userEmail: user.email,
      sessionEmail: session.email,
      hasSession: true,
      storedScopes: session.scope ? session.scope.split(' ') : [],
      actualScopesFromGoogle: actualScopes,
      hasGmailSend,
      tokenExpiresAt: session.token_expires_at,
      tokenInfoError,
    });
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
}





