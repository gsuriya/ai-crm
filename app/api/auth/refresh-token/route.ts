import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

/**
 * Force re-authentication with Google to get correct scopes
 * This redirects to the client-side OAuth flow
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

    // Redirect to sign-in page with a flag to force re-auth
    const redirectUrl = new URL('/auth/signin', request.nextUrl.origin);
    redirectUrl.searchParams.set('reauth', 'true');
    redirectUrl.searchParams.set('next', '/');
    
    return NextResponse.redirect(redirectUrl.toString());
  } catch (error: any) {
    console.error('Error in refresh-token route:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to refresh token' },
      { status: 500 }
    );
  }
}

