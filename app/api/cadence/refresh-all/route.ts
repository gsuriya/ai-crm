import { NextResponse } from "next/server";
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { getScheduledExecutions, getExecution, executeNextBlock } from '@/lib/services/cadence-execution';
import { checkAndPauseCadencesWithReplies, checkCompletedCadencesForReplies } from "@/lib/services/email-reply-detector";

/**
 * Comprehensive refresh endpoint that:
 * 1. Checks for email replies (active and completed cadences)
 * 2. Processes all scheduled emails that are ready to send
 * 3. Returns summary of what was done
 */
export async function POST() {
  try {
    console.log('[Refresh All] Starting comprehensive refresh...');
    
    const results = {
      repliesChecked: { active: 0, completed: 0 },
      repliesFound: { active: 0, completed: 0 },
      emailsProcessed: 0,
      errors: [] as string[],
    };

    // Create Supabase client with server-side auth
    const supabase = await createServerSupabaseClient();

    // STEP 1: Check for email replies on active cadences
    try {
      console.log('[Refresh All] Step 1: Checking active cadences for replies...');
      const activeResults = await checkAndPauseCadencesWithReplies(supabase);
      results.repliesChecked.active = activeResults.checked;
      results.repliesFound.active = activeResults.paused;
      console.log(`[Refresh All] ✅ Active cadences: checked ${activeResults.checked}, paused ${activeResults.paused}`);
    } catch (error: any) {
      console.error('[Refresh All] Error checking active cadences:', error);
      results.errors.push(`Active reply check failed: ${error.message}`);
    }

    // STEP 2: Check for email replies on completed cadences
    try {
      console.log('[Refresh All] Step 2: Checking completed cadences for replies...');
      const completedResults = await checkCompletedCadencesForReplies(supabase);
      results.repliesChecked.completed = completedResults.checked;
      results.repliesFound.completed = completedResults.responded;
      console.log(`[Refresh All] ✅ Completed cadences: checked ${completedResults.checked}, responded ${completedResults.responded}`);
    } catch (error: any) {
      console.error('[Refresh All] Error checking completed cadences:', error);
      results.errors.push(`Completed reply check failed: ${error.message}`);
    }

    // STEP 3: Process all scheduled emails that are ready to send
    try {
      console.log('[Refresh All] Step 3: Processing scheduled emails...');
      const executions = await getScheduledExecutions(supabase);
      console.log(`[Refresh All] Found ${executions.length} scheduled execution(s) ready to process`);

      for (const execution of executions) {
        try {
          // Check if execution is still active (might have been paused by reply check)
          const freshExecution = await getExecution(supabase, execution.id);
          if (!freshExecution || freshExecution.status !== 'active') {
            console.log(`[Refresh All] Skipping execution ${execution.id} - status is ${freshExecution?.status || 'not found'}`);
            continue;
          }

          // CRITICAL: Atomic check-and-clear to prevent double-processing
          if (!freshExecution.scheduled_for) {
            console.log(`[Refresh All] Skipping execution ${execution.id} - scheduled_for already cleared`);
            continue;
          }

          // Clear scheduled_for atomically
          const { data: updateResult, error: updateError } = await supabase
            .from('cadence_executions')
            .update({ scheduled_for: null })
            .eq('id', execution.id)
            .eq('status', 'active')
            .not('scheduled_for', 'is', null)
            .select();

          if (!updateResult || updateResult.length === 0) {
            console.log(`[Refresh All] Skipping execution ${execution.id} - already being processed`);
            continue;
          }

          if (updateError) {
            console.error(`[Refresh All] Error clearing scheduled_for:`, updateError);
            continue;
          }

          // Get cadence blocks
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
            throw new Error('Cadence or nodes not found');
          }

          // Execute the next block
          console.log(`[Refresh All] Executing block for execution ${execution.id}...`);
          await executeNextBlock(supabase, freshExecution, cadence.nodes);
          results.emailsProcessed++;
          console.log(`[Refresh All] ✅ Processed execution ${execution.id}`);
        } catch (error: any) {
          console.error(`[Refresh All] Error processing execution ${execution.id}:`, error);
          results.errors.push(`Execution ${execution.id}: ${error.message}`);
        }
      }

      console.log(`[Refresh All] ✅ Processed ${results.emailsProcessed} scheduled email(s)`);
    } catch (error: any) {
      console.error('[Refresh All] Error processing scheduled emails:', error);
      results.errors.push(`Email processing failed: ${error.message}`);
    }

    // Build response message
    const totalRepliesFound = results.repliesFound.active + results.repliesFound.completed;
    const messages = [];
    
    if (totalRepliesFound > 0) {
      messages.push(`Found ${totalRepliesFound} new reply/replies`);
    }
    
    if (results.emailsProcessed > 0) {
      messages.push(`Sent ${results.emailsProcessed} scheduled email(s)`);
    }
    
    if (messages.length === 0 && results.errors.length === 0) {
      messages.push('Everything is up to date');
    }

    console.log('[Refresh All] ✅ Refresh complete!');
    console.log('[Refresh All] Summary:', results);

    return NextResponse.json({
      success: true,
      message: messages.join(' • '),
      results,
    });
  } catch (error: any) {
    console.error('[Refresh All] Fatal error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to refresh' },
      { status: 500 }
    );
  }
}

// Also support GET for easy testing
export async function GET() {
  return POST();
}


