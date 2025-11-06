import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { checkAndPauseCadencesWithReplies } from '@/lib/services/email-reply-detector';

export async function POST(request: NextRequest) {
  try {
    // Create Supabase client with server-side auth
    const supabase = await createServerSupabaseClient();
    
    // Check for replies and pause cadences
    const result = await checkAndPauseCadencesWithReplies(supabase);

    return NextResponse.json({
      success: true,
      paused: result.paused,
      checked: result.checked,
      message: `Checked ${result.checked} cadence(s), paused ${result.paused} due to replies`,
    });
  } catch (error: any) {
    console.error('Error checking for email replies:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check for email replies' },
      { status: 500 }
    );
  }
}

// GET endpoint for manual triggering or health checks
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const result = await checkAndPauseCadencesWithReplies(supabase);
    
    return NextResponse.json({
      success: true,
      paused: result.paused,
      checked: result.checked,
    });
  } catch (error: any) {
    console.error('Error checking for email replies:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check for email replies' },
      { status: 500 }
    );
  }
}

