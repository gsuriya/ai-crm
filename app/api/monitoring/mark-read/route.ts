import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { markEventsAsRead } from '@/lib/services/company-monitoring';

/**
 * Mark all events as read for a company
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    
    // Get user session to verify authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { companyId } = body;

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId is required' },
        { status: 400 }
      );
    }

    // Mark events as read
    await markEventsAsRead(supabase, companyId);

    return NextResponse.json({
      success: true,
      message: 'Events marked as read',
    });
  } catch (error: any) {
    console.error('[Monitoring] Error marking events as read:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to mark events as read' },
      { status: 500 }
    );
  }
}

