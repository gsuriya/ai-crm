import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createServerSupabaseClient } from '@/lib/supabase-server';

/**
 * Google OAuth using Passport.js approach - but adapted for Next.js
 * Requests EXACT same scopes as sourcing directory
 */
export async function GET(request: NextRequest) {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get('code');
    const error = requestUrl.searchParams.get('error');

    if (error) {
        console.error('Google OAuth error:', error);
        return NextResponse.redirect(`${requestUrl.origin}/auth/signin?error=oauth_failed`);
    }

    if (!code) {
        // Initiate OAuth - redirect to Google with EXACT same scopes as sourcing directory
        const clientId = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
        const redirectUri = `${requestUrl.origin}/api/auth/passport-google`;
        
        if (!clientId) {
            return NextResponse.json({ error: 'Google Client ID not configured' }, { status: 500 });
        }

        const params = new URLSearchParams({
            client_id: clientId,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: [
                'profile',
                'email',
                'https://www.googleapis.com/auth/gmail.send',
                'https://www.googleapis.com/auth/gmail.readonly',
                'https://www.googleapis.com/auth/calendar.readonly',
                'https://www.googleapis.com/auth/calendar'
            ].join(' '),
            access_type: 'offline',
            prompt: 'consent'
        });

        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
        return NextResponse.redirect(authUrl);
    }

    // Exchange code for tokens
    try {
        const clientId = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_SECRET;
        const redirectUri = `${requestUrl.origin}/api/auth/passport-google`;

        if (!clientId || !clientSecret) {
            throw new Error('Google OAuth credentials not configured');
        }

        const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
        
        console.log('\n🔐 Google OAuth Callback (Passport.js style)');
        console.log('   Exchanging code for tokens...');
        
        const { tokens } = await oauth2Client.getToken(code);
        
        console.log('   Access Token received:', !!tokens.access_token);
        console.log('   Refresh Token received:', !!tokens.refresh_token);
        
        if (!tokens.access_token) {
            throw new Error('No access token received from Google');
        }

        if (!tokens.refresh_token) {
            console.warn('⚠️  WARNING: No refresh token received from Google!');
            console.warn('   User needs to revoke access and re-authorize.');
        }

        // Get user info
        oauth2Client.setCredentials(tokens);
        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
        const userInfo = await oauth2.userinfo.get();

        // Store tokens in user_sessions table
        const supabase = await createServerSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
            throw new Error('No Supabase user found. Please sign in first.');
        }

        const email = userInfo.data.email || user.email || '';

        const { error } = await supabase
            .from('user_sessions')
            .upsert({
                user_id: user.id,
                email: email,
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token || null,
                token_expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
                scope: tokens.scope || '', // Store scope string
            }, {
                onConflict: 'user_id',
            });

        if (error) {
            console.error('❌ Error storing tokens:', error);
            throw error;
        }

        console.log('✅ Tokens stored successfully for user:', user.email);
        console.log('✅ Scope:', tokens.scope || 'NONE');

        return NextResponse.redirect(`${requestUrl.origin}/test-email?success=true`);
    } catch (error: any) {
        console.error('❌ OAuth callback error:', error);
        return NextResponse.redirect(`${requestUrl.origin}/auth/signin?error=${encodeURIComponent(error.message)}`);
    }
}