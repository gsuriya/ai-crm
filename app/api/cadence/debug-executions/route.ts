import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    
    // Get ALL active executions
    const { data: allActiveExecutions, error: activeError } = await supabase
      .from('cadence_executions')
      .select('*, company_cadence:company_cadences(cadence_id)')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (activeError) {
      throw new Error(`Failed to get active executions: ${activeError.message}`);
    }
    
    // Also get executions with scheduled_for
    const { data: scheduledExecutions, error: scheduledError } = await supabase
      .from('cadence_executions')
      .select('*')
      .eq('status', 'active')
      .not('scheduled_for', 'is', null)
      .order('scheduled_for', { ascending: true });
    
    if (scheduledError) {
      throw new Error(`Failed to get scheduled executions: ${scheduledError.message}`);
    }
    
    const now = new Date().toISOString();
    
    return NextResponse.json({
      success: true,
      now,
      allActiveCount: allActiveExecutions?.length || 0,
      scheduledCount: scheduledExecutions?.length || 0,
      allActiveExecutions: allActiveExecutions?.map(e => ({
        id: e.id,
        company_cadence_id: e.company_cadence_id,
        current_block_id: e.current_block_id,
        scheduled_for: e.scheduled_for,
        status: e.status,
        created_at: e.created_at,
        updated_at: e.updated_at,
        isPastDue: e.scheduled_for ? e.scheduled_for <= now : null,
      })) || [],
      scheduledExecutions: scheduledExecutions?.map(e => ({
        id: e.id,
        company_cadence_id: e.company_cadence_id,
        current_block_id: e.current_block_id,
        scheduled_for: e.scheduled_for,
        status: e.status,
        isPastDue: e.scheduled_for <= now,
      })) || [],
    });
  } catch (error: any) {
    console.error('Error getting debug executions:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get debug executions' },
      { status: 500 }
    );
  }
}

