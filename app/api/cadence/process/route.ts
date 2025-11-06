import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { getScheduledExecutions, getExecution, executeNextBlock, updateExecutionState } from '@/lib/services/cadence-execution';
import { FlowBlock } from '@/components/cadence-flow-builder';

export async function POST(request: NextRequest) {
  try {
    // Create Supabase client with server-side auth
    const supabase = await createServerSupabaseClient();
    
    // First, check for email replies and pause cadences that have received replies
    try {
      const { checkAndPauseCadencesWithReplies } = await import('@/lib/services/email-reply-detector');
      const replyResult = await checkAndPauseCadencesWithReplies(supabase);
      if (replyResult.paused > 0) {
        console.log(`[Process] ⏸️ Paused ${replyResult.paused} cadence(s) due to email replies`);
      }
    } catch (replyError) {
      console.error('[Process] Error checking for replies:', replyError);
      // Continue processing even if reply check fails
    }
    
    // Get scheduled executions ready to process
    const executions = await getScheduledExecutions(supabase);

    if (executions.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        message: 'No scheduled executions ready to process',
      });
    }

    const processed: string[] = [];
    const errors: Array<{ executionId: string; error: string }> = [];

    for (const execution of executions) {
      try {
        // Check if execution is still active (might have been paused by reply check)
        const freshExecution = await getExecution(supabase, execution.id);
        if (!freshExecution || freshExecution.status !== 'active') {
          console.log(`[Process] Skipping execution ${execution.id} - status is ${freshExecution?.status || 'not found'}`);
          continue;
        }

        // CRITICAL: Atomic check-and-clear to prevent double-processing
        // Only process if scheduled_for is still set (hasn't been cleared by another process)
        if (!freshExecution.scheduled_for) {
          console.log(`[Process] Skipping execution ${execution.id} - scheduled_for already cleared (likely being processed by another process)`);
          continue;
        }

        // Clear scheduled_for atomically to prevent double-processing
        // Use a direct update with a WHERE clause to ensure we only clear if it's still set
        const { data: updateResult, error: updateError } = await supabase
          .from('cadence_executions')
          .update({ scheduled_for: null })
          .eq('id', execution.id)
          .eq('status', 'active')
          .not('scheduled_for', 'is', null)
          .select();

        // If no rows were updated, another process already cleared it
        if (!updateResult || updateResult.length === 0) {
          console.log(`[Process] Skipping execution ${execution.id} - scheduled_for already cleared by another process`);
          continue;
        }

        if (updateError) {
          console.error(`[Process] Error clearing scheduled_for for execution ${execution.id}:`, updateError);
          continue;
        }

        // Get cadence to retrieve blocks
        const { data: companyCadence } = await supabase
          .from('company_cadences')
          .select('cadence_id')
          .eq('id', execution.company_cadence_id)
          .single();

        if (!companyCadence) {
          throw new Error('Company cadence not found');
        }

        const { data: cadence } = await supabase
          .from('cadences')
          .select('nodes')
          .eq('id', companyCadence.cadence_id)
          .single();

        if (!cadence || !cadence.nodes) {
          throw new Error('Cadence not found or has no blocks');
        }

        const blocks = cadence.nodes as FlowBlock[];

        // Get execution again with cleared scheduled_for (reuse the variable we already have)
        const executionAfterClear = await getExecution(supabase, execution.id);
        if (!executionAfterClear) {
          throw new Error('Failed to fetch execution after clearing scheduled_for');
        }

        // Execute the next block
        // CRITICAL: Pass skipRecursion flag to prevent double execution
        // Background processor will handle subsequent scheduled executions
        await executeNextBlock(supabase, executionAfterClear, blocks, { skipRecursion: true });

        processed.push(execution.id);
      } catch (error: any) {
        console.error(`Error processing execution ${execution.id}:`, error);
        errors.push({
          executionId: execution.id,
          error: error.message || 'Unknown error',
        });

        // Mark execution as error
        try {
          await updateExecutionState(supabase, execution.id, {
            status: 'error',
            metadata: {
              ...execution.metadata,
              error: error.message || 'Unknown error',
            },
          });
        } catch (updateError) {
          console.error('Error updating execution status:', updateError);
        }
      }
    }

    return NextResponse.json({
      success: true,
      processed: processed.length,
      errors: errors.length,
      processedIds: processed,
      errorsList: errors,
    });
  } catch (error: any) {
    console.error('Error processing scheduled executions:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process scheduled executions' },
      { status: 500 }
    );
  }
}

// GET endpoint for manual triggering or health checks
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const executions = await getScheduledExecutions(supabase);
    
    return NextResponse.json({
      success: true,
      scheduledCount: executions.length,
      executions: executions.map(e => ({
        id: e.id,
        company_cadence_id: e.company_cadence_id,
        current_block_id: e.current_block_id,
        scheduled_for: e.scheduled_for,
        status: e.status,
      })),
    });
  } catch (error: any) {
    console.error('Error getting scheduled executions:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get scheduled executions' },
      { status: 500 }
    );
  }
}

