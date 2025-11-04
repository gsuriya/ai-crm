import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { getExecution } from '@/lib/services/cadence-execution';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { searchParams } = new URL(request.url);
    const executionId = searchParams.get('execution_id');

    if (!executionId) {
      return NextResponse.json({ error: 'execution_id required' }, { status: 400 });
    }

    const execution = await getExecution(supabase, executionId);
    
    if (!execution) {
      return NextResponse.json({ error: 'Execution not found' }, { status: 404 });
    }

    return NextResponse.json({
      execution_id: execution.id,
      status: execution.status,
      current_block_id: execution.current_block_id,
      threadInfoMap: execution.metadata?.threadInfoMap || {},
      metadata: execution.metadata,
    });
  } catch (error: any) {
    console.error('[Execution Status] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

