import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { getScheduledExecutions, getExecution, executeNextBlock, updateExecutionState } from '@/lib/services/cadence-execution';
import { FlowBlock } from '@/components/cadence-flow-builder';

export async function POST(request: NextRequest) {
  try {
    // Create Supabase client with server-side auth
    const supabase = await createServerSupabaseClient();
    
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
        // Clear scheduled_for to prevent double-processing
        // The execution is being processed now, so clear the scheduled time
        await updateExecutionState(supabase, execution.id, {
          scheduled_for: null,
        });

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

        // Get fresh execution with cleared scheduled_for
        const freshExecution = await getExecution(supabase, execution.id);
        if (!freshExecution) {
          throw new Error('Failed to fetch execution after clearing scheduled_for');
        }

        // Execute the next block
        await executeNextBlock(supabase, freshExecution, blocks);

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

