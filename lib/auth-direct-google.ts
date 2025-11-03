'use client';

import { useState } from 'react';
import { google } from 'googleapis';
import { supabase } from '@/lib/supabase';

/**
 * Direct Google OAuth flow that bypasses Supabase's OAuth handling
 * This ensures we get the exact scopes we need
 */
export async function signInWithGoogleDirect() {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const redirectUri = `${window.location.origin}/auth/google-callback`;
  
  if (!clientId) {
    throw new Error('Google Client ID not configured');
  }

  // Build the Google OAuth URL directly
  const scopes = [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'openid',
  ].join(' ');

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes,
    access_type: 'offline',
    prompt: 'consent', // Force consent screen
    include_granted_scopes: 'true',
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  
  // Redirect to Google OAuth
  window.location.href = authUrl;
}





