import { supabase } from './supabase';

/**
 * Sign in with Google using Supabase OAuth
 * 
 * NOTE: Supabase does NOT forward custom scopes to Google (confirmed - no scopes field in dashboard).
 * Use signInWithGoogleDirect() instead to get the scopes we need.
 */
export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      scopes: 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
        scope: 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
      },
    },
  });
  
  if (error) {
    console.error('Error signing in with Google:', error);
    throw error;
  }
  
  return data;
}

/**
 * Direct Google OAuth that bypasses Supabase's OAuth handling
 * This ensures we get the exact scopes we need (gmail.send, calendar.events)
 * 
 * The callback handler will:
 * 1. Get tokens directly from Google with correct scopes
 * 2. Sign in to Supabase for user management
 * 3. Store Google tokens in user_sessions table
 */
export async function signInWithGoogleDirect() {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const redirectUri = `${window.location.origin}/auth/google-callback`;
  
  if (!clientId) {
    throw new Error('Google Client ID not configured. Set NEXT_PUBLIC_GOOGLE_CLIENT_ID in .env.local');
  }

  // Build the Google OAuth URL directly - this bypasses Supabase entirely
  // EXACTLY match sourcing directory scopes (line 719 in sourcing/backend/server.js)
  const scopes = [
    'profile',
    'email',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/calendar', // Full calendar scope like sourcing directory
    'openid',
  ].join(' ');

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes,
    access_type: 'offline',
    prompt: 'consent', // Force consent screen to grant all scopes
    include_granted_scopes: 'true',
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  
  // Redirect to Google OAuth
  window.location.href = authUrl;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  
  if (error) {
    console.error('Error signing out:', error);
    throw error;
  }
}

export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (error) {
    console.error('Error getting session:', error);
    return null;
  }
  
  return session;
}

export async function getUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error) {
    console.error('Error getting user:', error);
    return null;
  }
  
  return user;
}
