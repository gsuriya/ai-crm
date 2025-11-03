import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { google } from 'googleapis';

/**
 * API route to complete sign-in after direct Google OAuth
 * Reads tokens from cookie and stores them in user_sessions
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    
    // Get current user (should be signed in via Supabase)
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Not authenticated. Please sign in first.',
      }, { status: 401 });
    }

    // Get tokens from cookie
    const cookieStore = request.cookies;
    const tokenCookie = cookieStore.get('google_oauth_tokens');
    
    if (!tokenCookie) {
      return NextResponse.json({
        success: false,
        error: 'No OAuth tokens found. Please sign in again.',
      }, { status: 400 });
    }

    const tokenData = JSON.parse(tokenCookie.value);
    
    // Verify tokens with Google to get actual scopes
    const clientId = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      return NextResponse.json({
        success: false,
        error: 'Google OAuth not configured',
      }, { status: 500 });
    }

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback`
    );

    oauth2Client.setCredentials({
      access_token: tokenData.access_token,
    });

    // Verify scopes
    let actualScopes: string[] = [];
    try {
      const tokenInfo = await oauth2Client.getTokenInfo(tokenData.access_token);
      actualScopes = tokenInfo.scope ? tokenInfo.scope.split(' ') : [];
    } catch (error: any) {
      console.error('Error verifying token:', error);
    }

    const scopeString = tokenData.scope || (actualScopes.length > 0 ? actualScopes.join(' ') : '');
    
    console.log('✅ Completing sign-in for user:', user.email);
    console.log('✅ Storing tokens with scope:', scopeString);
    console.log('✅ Has gmail.send:', scopeString.includes('gmail.send'));

    // Store tokens in user_sessions
    const { error: sessionError } = await supabase
      .from('user_sessions')
      .upsert({
        user_id: user.id,
        email: tokenData.email || user.email || '',
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || null,
        token_expires_at: tokenData.expires_at || null,
        scope: scopeString,
      }, {
        onConflict: 'user_id',
      });

    if (sessionError) {
      console.error('Error storing user session:', sessionError);
      return NextResponse.json({
        success: false,
        error: `Failed to store tokens: ${sessionError.message}`,
      }, { status: 500 });
    }

    // Clear the cookie
    const response = NextResponse.json({
      success: true,
      message: 'Sign-in completed successfully',
      scopes: actualScopes,
    });

    response.cookies.delete('google_oauth_tokens');

    return response;
  } catch (error: any) {
    console.error('Error completing sign-in:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to complete sign-in',
    }, { status: 500 });
  }
}





