import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { google } from 'googleapis';

/**
 * Debug endpoint to check what scopes Google actually granted
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get user session
    const { data: session } = await supabase
      .from('user_sessions')
      .select('access_token, scope')
      .eq('user_id', user.id)
      .single();

    if (!session?.access_token) {
      return NextResponse.json({ error: 'No session found' }, { status: 404 });
    }

    // Check what Google actually returned
    const clientId = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      return NextResponse.json({ error: 'Missing credentials' }, { status: 500 });
    }

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback`
    );

    oauth2Client.setCredentials({ access_token: session.access_token });

    try {
      const tokenInfo = await oauth2Client.getTokenInfo(session.access_token);
      const actualScopes = tokenInfo.scopes || [];
      
      return NextResponse.json({
        storedScopes: session.scope ? session.scope.split(' ') : [],
        actualScopesFromGoogle: actualScopes,
        hasGmailSend: actualScopes.includes('https://www.googleapis.com/auth/gmail.send') || 
                     actualScopes.some((s: string) => s.includes('gmail.send')),
        missingScopes: [
          'https://www.googleapis.com/auth/gmail.send',
          'https://www.googleapis.com/auth/calendar.events',
        ].filter(req => !actualScopes.includes(req) && !actualScopes.some((s: string) => s.includes(req.split('/').pop() || ''))),
      });
    } catch (error: any) {
      return NextResponse.json({
        error: 'Could not verify token',
        details: error.message,
        storedScopes: session.scope ? session.scope.split(' ') : [],
      }, { status: 500 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}





