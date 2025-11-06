import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { checkThreadForReply } from '@/lib/services/email-reply-detector';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { thread_id, recipient_email } = body;

    if (!thread_id || !recipient_email) {
      return NextResponse.json(
        { error: 'thread_id and recipient_email are required' },
        { status: 400 }
      );
    }

    // Create server-side Supabase client
    const supabase = await createServerSupabaseClient();
    
    // Get user session to verify authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check for replies in the thread
    const hasReply = await checkThreadForReply(
      user.id,
      thread_id,
      recipient_email,
      supabase
    );

    return NextResponse.json({
      success: true,
      hasReply,
      thread_id,
      recipient_email,
    });
  } catch (error: any) {
    console.error('Error checking for email reply:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check for email reply', hasReply: false },
      { status: 500 }
    );
  }
}

