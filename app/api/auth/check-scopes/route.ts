import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { google } from 'googleapis';

/**
 * Check what scopes the current user's Google token actually has
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
      process.env.GOOGLE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback`
    );

    oauth2Client.setCredentials({
      access_token: session.access_token,
    });

    // Get token info from Google
    try {
      const tokenInfo = await oauth2Client.getTokenInfo(session.access_token);
      const actualScopes = tokenInfo.scope ? tokenInfo.scope.split(' ') : [];
      
      return NextResponse.json({
        success: true,
        userId: user.id,
        userEmail: user.email,
        storedScopes: session.scope ? session.scope.split(' ') : [],
        actualScopesFromGoogle: actualScopes,
        tokenExpiresAt: session.token_expires_at,
        hasGmailSend: actualScopes.includes('https://www.googleapis.com/auth/gmail.send') || 
                     actualScopes.some(s => s.includes('gmail.send')),
        missingScopes: [
          'https://www.googleapis.com/auth/gmail.send',
          'https://www.googleapis.com/auth/calendar.events',
        ].filter(required => !actualScopes.includes(required) && 
                            !actualScopes.some(s => s.includes(required.split('/').pop() || ''))),
      });
    } catch (tokenInfoError: any) {
      return NextResponse.json({
        success: false,
        error: 'Could not verify token with Google',
        details: tokenInfoError.message,
        storedScopes: session.scope ? session.scope.split(' ') : [],
        userId: user.id,
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Error checking scopes:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check scopes' },
      { status: 500 }
    );
  }
}





