import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') || '/companies';
  const error = requestUrl.searchParams.get('error');

  // Handle OAuth errors
  if (error) {
    console.error('OAuth error:', error);
    return NextResponse.redirect(`${requestUrl.origin}/auth/signin?error=auth_failed`);
  }

  if (code) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.redirect(`${requestUrl.origin}/auth/signin?error=configuration`);
    }

    // Create server-side Supabase client with cookie handling
    const cookieStore = await cookies();
    const response = NextResponse.redirect(`${requestUrl.origin}${next}`);
    
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          // Set cookies on the response
          response.cookies.set(name, value, options);
        },
        remove(name: string, options: any) {
          // Remove cookies from the response
          response.cookies.delete(name);
        },
      },
    });
    
    // Exchange the code for a session
    const { data: { session }, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    
    if (exchangeError) {
      console.error('Error exchanging code for session:', exchangeError);
      return NextResponse.redirect(`${requestUrl.origin}/auth/signin?error=auth_failed`);
    }

    // ⚠️ CRITICAL: Don't overwrite tokens from direct Google OAuth!
    // Supabase's OAuth doesn't forward custom scopes properly.
    // If user already has tokens from direct Google OAuth, keep those.
    // Only store Supabase tokens if no existing tokens exist.
    
    if (session?.user && session?.provider_token) {
      try {
        // Check if user already has tokens from direct Google OAuth
        const { data: existingSession } = await supabase
          .from('user_sessions')
          .select('access_token, refresh_token, scope')
          .eq('user_id', session.user.id)
          .single();

        // If existing tokens exist and have gmail.send scope, DON'T overwrite
        if (existingSession?.scope?.includes('gmail.send')) {
          console.log('⚠️ User already has tokens with gmail.send scope from direct Google OAuth. Keeping those.');
          console.log('⚠️ Supabase OAuth tokens NOT stored to avoid overwriting valid tokens.');
          return response; // Don't overwrite!
        }

        // Only store Supabase tokens if no valid tokens exist
        console.log('⚠️ No existing tokens with gmail.send found. Storing Supabase tokens.');
        console.log('⚠️ NOTE: Supabase OAuth may not have gmail.send scope!');
        console.log('⚠️ Consider using direct Google OAuth instead (signInWithGoogleDirect)');
        
        // Get user's email
        const userEmail = session.user.email || '';
        
        // Try to get the actual scope from the session
        const providerMetadata = session.user.user_metadata?.provider_metadata || {};
        const appMetadata = session.user.app_metadata || {};
        const rawUserMetadata = session.user.user_metadata || {};
        
        console.log('🔍 Supabase OAuth Callback - Session metadata:', {
          providerMetadata,
          appMetadata,
          rawUserMetadata,
          hasProviderToken: !!session.provider_token,
          hasProviderRefreshToken: !!session.provider_refresh_token,
        });
        
        // Try to get actual scope from various locations
        let scope = providerMetadata.scope || 
                    appMetadata.provider_metadata?.scope ||
                    rawUserMetadata.scope ||
                    ''; // Don't assume scopes - Supabase OAuth doesn't forward them!
        
        // Store tokens in user_sessions table
        const { error: sessionError } = await supabase
          .from('user_sessions')
          .upsert({
            user_id: session.user.id,
            email: userEmail,
            access_token: session.provider_token,
            refresh_token: session.provider_refresh_token || null,
            token_expires_at: session.expires_at 
              ? new Date(session.expires_at * 1000).toISOString() 
              : null,
            scope: scope, // May be empty if Supabase didn't forward scopes
          }, {
            onConflict: 'user_id',
          });

        if (sessionError) {
          console.error('❌ Error storing user session:', sessionError);
          // Don't fail the auth flow, just log the error
        } else {
          console.log('✅ Stored Supabase OAuth tokens (may be missing gmail.send scope!)');
        }
      } catch (error) {
        console.error('❌ Error in token storage:', error);
        // Don't fail the auth flow
      }
    }

    // Return the response with cookies set
    return response;
  }

  // No code provided, redirect to sign-in
  return NextResponse.redirect(`${requestUrl.origin}/auth/signin?error=no_code`);
}

