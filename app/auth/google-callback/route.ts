import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { google } from 'googleapis';

/**
 * Direct Google OAuth callback handler
 * This bypasses Supabase's OAuth and gets tokens directly from Google
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const error = requestUrl.searchParams.get('error');

  if (error) {
    console.error('Google OAuth error:', error);
    return NextResponse.redirect(`${requestUrl.origin}/auth/signin?error=google_auth_failed`);
  }

  if (!code) {
    return NextResponse.redirect(`${requestUrl.origin}/auth/signin?error=no_code`);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_SECRET;
  const redirectUri = `${requestUrl.origin}/auth/google-callback`;

  if (!clientId || !clientSecret) {
    console.error('Missing Google OAuth credentials');
    return NextResponse.redirect(`${requestUrl.origin}/auth/signin?error=configuration`);
  }

  try {
    // Exchange code for tokens directly with Google
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    
    console.log('🔍 About to exchange code for tokens:', {
      redirectUri,
      clientId: clientId?.substring(0, 20) + '...',
      codeLength: code.length,
    });
    
    const { tokens } = await oauth2Client.getToken(code);
    
    console.log('🔍 FULL tokens object from Google:', JSON.stringify({
      access_token: tokens.access_token ? `${tokens.access_token.substring(0, 20)}...` : null,
      refresh_token: tokens.refresh_token ? 'PRESENT' : null,
      id_token: tokens.id_token ? 'PRESENT' : null,
      scope: tokens.scope, // THIS IS THE KEY - check if Google includes scope here
      expiry_date: tokens.expiry_date,
      token_type: tokens.token_type,
    }, null, 2));

    if (!tokens.access_token) {
      throw new Error('No access token received from Google');
    }

    // Get token info to verify scopes
    // IMPORTANT: Google sometimes returns scopes in tokens.scope instead of tokenInfo.scope
    let actualScopes: string[] = [];
    let scopeString = '';
    
    // FIRST: Check if scopes are in the tokens object (most reliable)
    if (tokens.scope) {
      scopeString = tokens.scope;
      actualScopes = tokens.scope.split(' ').filter(s => s.length > 0);
      console.log('✅ Found scopes in tokens.scope property:', actualScopes);
    }
    
    // SECOND: Try to get token info from Google API (may be empty if scopes weren't granted)
    try {
      const tokenInfo = await oauth2Client.getTokenInfo(tokens.access_token);
      
      if (tokenInfo.scope && tokenInfo.scope.trim().length > 0) {
        const tokenInfoScopes = tokenInfo.scope.split(' ').filter(s => s.length > 0);
        console.log('✅ Token info from Google API also has scopes:', tokenInfoScopes);
        
        // Use tokenInfo if it has more scopes or tokens.scope is empty
        if (tokenInfoScopes.length > actualScopes.length || actualScopes.length === 0) {
          scopeString = tokenInfo.scope;
          actualScopes = tokenInfoScopes;
        }
      } else {
        console.warn('⚠️ Token info returned but scope is empty:', tokenInfo.scope);
      }
      
      console.log('✅ Final token info:', {
        scope: tokenInfo.scope,
        scopesArray: actualScopes,
        expiryDate: tokenInfo.expiry_date,
      });
    } catch (tokenInfoError: any) {
      console.error('❌ Error getting token info:', tokenInfoError.message);
      
      // If we have scopes from tokens.scope, that's fine
      if (actualScopes.length > 0) {
        console.log('✅ Using scopes from tokens.scope despite tokenInfo error');
      } else {
        console.error('❌ No scope found in tokens object or token info!');
      }
    }
    
    console.log('✅ Direct Google OAuth - Final scopes:', actualScopes);
    console.log('✅ Has gmail.send:', actualScopes.includes('https://www.googleapis.com/auth/gmail.send'));

    // CRITICAL: Verify Google actually granted the required scopes
    // Match sourcing directory requirements
    const requiredScopes = [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/calendar', // Full calendar scope like sourcing directory
    ];
    
    const missingScopes = requiredScopes.filter(
      req => !actualScopes.includes(req) && !actualScopes.some(s => s.includes(req.split('/').pop() || ''))
    );

    if (missingScopes.length > 0 || actualScopes.length === 0) {
      console.error('❌ CRITICAL: Google did NOT grant required scopes!', {
        requestedScopes: requiredScopes,
        actualScopesGranted: actualScopes,
        missingScopes,
        tokensObjectHasScope: !!tokens.scope,
        tokensScopeValue: tokens.scope,
      });
      
      // IMPORTANT: If gmail.send is missing, the app likely needs verification
      // or the user needs to be added as a test user in Google Cloud Console
      const errorMessage = actualScopes.length === 0 
        ? 'Google returned a token with NO scopes. This usually means:\n' +
          '1. Your app needs verification in Google Cloud Console\n' +
          '2. OR you need to add yourself as a test user\n' +
          '3. OR the scopes need to be enabled in OAuth consent screen\n\n' +
          'Go to: https://console.cloud.google.com/apis/credentials/consent'
        : `Missing scopes: ${missingScopes.join(', ')}`;
      
      // Redirect with error message
      return NextResponse.redirect(
        `${requestUrl.origin}/auth/signin?error=scopes_not_granted&` +
        `missing=${encodeURIComponent(missingScopes.join(','))}&` +
        `actual=${encodeURIComponent(actualScopes.join(',') || 'NONE')}&` +
        `message=${encodeURIComponent(errorMessage)}`
      );
    }

    console.log('✅ All required scopes granted by Google');

    // Now we need to sign in to Supabase with these tokens
    // Option 1: Use Supabase's signInWithIdToken (if we can get an ID token)
    // Option 2: Store tokens separately and associate with Supabase user
    
    // Get user info from Google
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();

    // Create Supabase client
    const cookieStore = await cookies();
    const response = NextResponse.redirect(`${requestUrl.origin}/`);
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            response.cookies.set(name, value, options);
          },
          remove(name: string, options: any) {
            response.cookies.delete(name);
          },
        },
      }
    );

    // IMPORTANT: Store the SCOPE STRING, not the access token!
    // scopeString is already set above from tokenInfo or tokens.scope
    console.log('✅ Direct Google OAuth - Final scopes to store:', actualScopes);
    console.log('✅ Scope string to store:', scopeString);
    console.log('✅ Has gmail.send:', actualScopes.includes('https://www.googleapis.com/auth/gmail.send'));

    // Try to sign in with Supabase using ID token
    if (tokens.id_token) {
      const { data: authData, error: authError } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: tokens.id_token,
      });

      if (authError) {
        console.error('❌ Error signing in with Supabase signInWithIdToken:', authError);
        console.log('Will try alternative sign-in method...');
      } else if (authData?.user) {
        console.log('✅ Signed in to Supabase with ID token, user:', authData.user.email);
        
        // Store Google tokens in user_sessions table
        const { error: sessionError } = await supabase
          .from('user_sessions')
          .upsert({
            user_id: authData.user.id,
            email: userInfo.data.email || authData.user.email || '',
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token || null,
            token_expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
            scope: scopeString, // Store the SCOPE STRING, not the token!
          }, {
            onConflict: 'user_id',
          });

        if (sessionError) {
          console.error('❌ Error storing user session:', sessionError);
          return NextResponse.redirect(`${requestUrl.origin}/auth/signin?error=session_storage_failed`);
        } else {
          console.log('✅ Stored Google OAuth tokens with correct scopes for user:', authData.user.email);
          console.log('✅ Scope string stored:', scopeString);
          return response;
        }
      }
    }

    // Fallback: signInWithIdToken failed, so we need to handle this differently
    // Check if user is already signed in (might have existing session)
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    
    if (currentUser) {
      // User is already signed in, just store the tokens
      console.log('✅ User already signed in, storing tokens directly');
      const { error: sessionError } = await supabase
        .from('user_sessions')
        .upsert({
          user_id: currentUser.id,
          email: userInfo.data.email || currentUser.email || '',
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token || null,
          token_expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
          scope: scopeString,
        }, {
          onConflict: 'user_id',
        });

      if (sessionError) {
        console.error('❌ Error storing user session:', sessionError);
        return NextResponse.redirect(`${requestUrl.origin}/auth/signin?error=session_storage_failed`);
      } else {
        console.log('✅ Stored Google OAuth tokens with correct scopes for existing user:', currentUser.email);
        return response;
      }
    }

    // No existing session, store tokens temporarily in cookie to complete sign-in on client side
    const tokenData = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || null,
      expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
      scope: scopeString,
      email: userInfo.data.email || '',
    };

    response.cookies.set('google_oauth_tokens', JSON.stringify(tokenData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 300, // 5 minutes
    });

    // Redirect to a page that will complete the sign-in
    return NextResponse.redirect(`${requestUrl.origin}/auth/complete-signin`);
  } catch (error: any) {
    console.error('Error in direct Google OAuth callback:', error);
    return NextResponse.redirect(`${requestUrl.origin}/auth/signin?error=oauth_failed`);
  }
}

