import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { getUnreadEventCount } from '@/lib/services/company-monitoring';

/**
 * Get unread event count for a company
 */
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId is required' },
        { status: 400 }
      );
    }

    // Get unread count
    const count = await getUnreadEventCount(supabase, companyId);

    return NextResponse.json({
      success: true,
      count,
    });
  } catch (error: any) {
    console.error('[Monitoring] Error getting unread count:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get unread count' },
      { status: 500 }
    );
  }
}

