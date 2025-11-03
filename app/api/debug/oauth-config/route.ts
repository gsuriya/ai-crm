import { NextRequest, NextResponse } from 'next/server';

/**
 * Debug endpoint to check OAuth configuration
 */
export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/google-callback`;
  
  const scopes = [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'openid',
  ];

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + new URLSearchParams({
    client_id: clientId || 'NOT_SET',
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
  }).toString();

  return NextResponse.json({
    clientId: clientId ? `${clientId.substring(0, 20)}...` : 'NOT_SET',
    redirectUri,
    requestedScopes: scopes,
    testAuthUrl: authUrl,
    instructions: [
      '1. Go to: https://console.cloud.google.com/apis/credentials/consent',
      '2. Click "EDIT APP"',
      '3. Go to "Scopes" tab',
      '4. Click "ADD OR REMOVE SCOPES"',
      '5. Search for and ADD these scopes:',
      '   - https://www.googleapis.com/auth/gmail.send',
      '   - https://www.googleapis.com/auth/calendar.events',
      '6. Click "UPDATE"',
      '7. Go to "Test users" tab',
      '8. Make sure your email is listed',
      '9. Save all changes',
      '10. Try signing in again',
    ],
  });
}





