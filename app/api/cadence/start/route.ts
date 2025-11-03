import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { startWorkflowExecution, executeNextBlock, getExecution } from '@/lib/services/cadence-execution';
import { FlowBlock } from '@/components/cadence-flow-builder';

/**
 * Start executing a cadence for a company
 * This is called from the company page when clicking "Start Cadence"
 */
export async function PUT(request: NextRequest) {
  try {
    console.log('[Cadence Start] ========== RESTART REQUEST RECEIVED ==========');
    const body = await request.json();
    const { company_cadence_id } = body;
    
    console.log('[Cadence Start] Request body:', { company_cadence_id });

    if (!company_cadence_id) {
      console.error('[Cadence Start] ❌ Missing company_cadence_id');
      return NextResponse.json(
        { error: 'company_cadence_id is required' },
        { status: 400 }
      );
    }

    // Create Supabase client with server-side auth
    const supabase = await createServerSupabaseClient();

    // Check session first
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    console.log('[Cadence Start] Session check:', { 
      hasSession: !!session,
      userId: session?.user?.id,
      sessionError: sessionError?.message 
    });

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    console.log('[Cadence Start] Auth check:', { 
      hasUser: !!user, 
      userId: user?.id,
      userEmail: user?.email,
      authError: authError?.message,
      errorCode: authError?.status 
    });
    
    if (authError || !user) {
      console.error('[Cadence Start] Auth failed:', authError);
      return NextResponse.json(
        { error: 'Unauthorized - please sign in', details: authError?.message },
        { status: 401 }
      );
    }

    // Get company_cadence association
    const { data: companyCadence, error: ccError } = await supabase
      .from('company_cadences')
      .select('*, cadence:cadences(*)')
      .eq('id', company_cadence_id)
      .single();

    if (ccError || !companyCadence) {
      return NextResponse.json(
        { error: 'Company cadence not found' },
        { status: 404 }
      );
    }

    // All cadences are shared company-wide - no ownership check needed
    const cadence = companyCadence.cadence as any;
    console.log('[Cadence Start] Starting cadence:', {
      cadenceId: cadence.id,
      cadenceName: cadence.name,
      executedBy: user.email
    });

    // Handle restarting completed cadences
    if (companyCadence.status === 'completed') {
      console.log('[Cadence Start] 🔄 Restarting completed cadence...');
      // Reset to active and start fresh
      await supabase
        .from('company_cadences')
        .update({ status: 'active', completed_at: null })
        .eq('id', company_cadence_id);
      
      // Get blocks from cadence FROM SUPABASE
      const blocks = (cadence.nodes || []) as FlowBlock[];
      console.log('[Cadence Start] 📦 Blocks loaded from Supabase:', blocks.length);
      console.log('[Cadence Start] 📦 Full blocks structure:', JSON.stringify(blocks, null, 2));
      
      // Verify trigger block exists and has connections
      const triggerBlock = blocks.find(b => b.type === 'trigger');
      if (triggerBlock) {
        console.log('[Cadence Start] ✅ Trigger block found:', {
          id: triggerBlock.id,
          connections: triggerBlock.connections || [],
        });
        if (!triggerBlock.connections || triggerBlock.connections.length === 0) {
          console.error('[Cadence Start] ❌ Trigger block has NO connections!');
        }
      } else {
        console.error('[Cadence Start] ❌ No trigger block found!');
      }
      
      console.log('[Cadence Start] Blocks from cadence:', blocks.map(b => ({ id: b.id, type: b.type, title: b.title })));
      
      if (!blocks || blocks.length === 0) {
        console.error('[Cadence Start] ❌ No blocks found in cadence');
        return NextResponse.json(
          { error: 'Cadence has no blocks' },
          { status: 400 }
        );
      }

      // Start fresh workflow execution
      console.log('[Cadence Start] Creating new execution...');
      const { companyCadenceId, executionId } = await startWorkflowExecution(
        supabase,
        companyCadence.company_id,
        companyCadence.cadence_id,
        blocks
      );
      console.log('[Cadence Start] ✅ Created execution:', executionId);

      // Execute first block after trigger
      const execution = await getExecution(supabase, executionId);
      if (execution) {
        try {
          console.log('[Cadence Start] 🚀 About to execute first block...');
          console.log('[Cadence Start] Execution details:', {
            id: execution.id,
            current_block_id: execution.current_block_id,
            status: execution.status,
            metadata: execution.metadata,
          });
          console.log('[Cadence Start] Blocks in cadence:', blocks.map(b => ({ id: b.id, type: b.type, title: b.title })));
          
          await executeNextBlock(supabase, execution, blocks);
          console.log('[Cadence Start] ✅ Successfully executed first block');
          return NextResponse.json({
            success: true,
            message: 'Cadence restarted',
            execution_id: executionId,
          });
        } catch (restartError: any) {
          console.error('[Cadence] ❌ Error restarting completed cadence:', restartError);
          console.error('[Cadence] ❌ Error details:', {
            message: restartError.message,
            stack: restartError.stack,
          });
          await supabase
            .from('cadence_executions')
            .update({ 
              status: 'error',
              metadata: {
                ...execution.metadata,
                error: restartError.message,
              }
            })
            .eq('id', executionId);
          
          const isScopeError = restartError.message?.includes('missing required scope') ||
                              restartError.message?.includes('insufficient authentication scopes') ||
                              restartError.message?.includes('OAuth token missing required scope') ||
                              restartError.message?.includes('Token missing required scope') ||
                              restartError.message?.includes('gmail.send');
          
          return NextResponse.json({
            success: false,
            error: `Failed to restart cadence: ${restartError.message}`,
            execution_id: executionId,
            isScopeError,
          }, { status: isScopeError ? 403 : 500 });
        }
      }
      return NextResponse.json({
        success: false,
        error: 'Failed to get execution after creating it',
      }, { status: 500 });
    }

    // Check if already active - allow restarting
    if (companyCadence.status === 'active') {
      // Check if there's an active execution
      const { data: activeExecution } = await supabase
        .from('cadence_executions')
        .select('*')
        .eq('company_cadence_id', company_cadence_id)
        .eq('status', 'active')
        .single();

      if (activeExecution) {
        // Resume existing execution - but check if current block exists in current cadence
        const blocks = (cadence.nodes || []) as FlowBlock[];
        const currentBlockExists = blocks.some(b => b.id === activeExecution.current_block_id);
        
        if (!currentBlockExists) {
          // Current block doesn't exist in updated cadence - reset to start
          console.log('[Cadence Start] ⚠️ Current block not found in updated cadence, resetting to trigger');
          const triggerBlock = blocks.find(b => b.type === 'trigger');
          if (!triggerBlock || !triggerBlock.connections || triggerBlock.connections.length === 0) {
            return NextResponse.json({
              success: false,
              error: 'Cadence has no valid trigger block',
            }, { status: 400 });
          }
          
          // Reset execution to trigger's first connection
          await supabase
            .from('cadence_executions')
            .update({
              current_block_id: triggerBlock.connections[0],
              status: 'active',
              scheduled_for: null,
            })
            .eq('id', activeExecution.id);
          
          // Get updated execution and execute
          const updatedExecution = await getExecution(supabase, activeExecution.id);
          if (updatedExecution) {
            await executeNextBlock(supabase, updatedExecution, blocks);
            return NextResponse.json({
              success: true,
              message: 'Cadence restarted from beginning',
              execution_id: activeExecution.id,
            });
          }
        }
        
        // Resume existing execution
        try {
          await executeNextBlock(supabase, activeExecution as any, blocks);
          return NextResponse.json({
            success: true,
            message: 'Cadence execution resumed',
            execution_id: activeExecution.id,
          });
        } catch (resumeError: any) {
          console.error('[Cadence] Error resuming execution:', resumeError);
          // Mark execution as error
          await supabase
            .from('cadence_executions')
            .update({ 
              status: 'error',
              metadata: {
                ...(activeExecution.metadata || {}),
                error: resumeError.message,
              }
            })
            .eq('id', activeExecution.id);
          
          // Check if it's a scope-related error
          const isScopeError = resumeError.message?.includes('missing required scope') ||
                              resumeError.message?.includes('insufficient authentication scopes') ||
                              resumeError.message?.includes('OAuth token missing required scope') ||
                              resumeError.message?.includes('Token missing required scope') ||
                              resumeError.message?.includes('gmail.send');
          
          return NextResponse.json({
            success: false,
            error: `Failed to resume execution: ${resumeError.message}`,
            execution_id: activeExecution.id,
            isScopeError, // Flag to help frontend detect scope errors
          }, { status: isScopeError ? 403 : 500 });
        }
      } else {
        // No active execution, start fresh
        const blocks = (cadence.nodes || []) as FlowBlock[];
        const { companyCadenceId, executionId } = await startWorkflowExecution(
          supabase,
          companyCadence.company_id,
          companyCadence.cadence_id,
          blocks
        );
        const execution = await getExecution(supabase, executionId);
        if (execution) {
          try {
            await executeNextBlock(supabase, execution, blocks);
            return NextResponse.json({
              success: true,
              message: 'Cadence restarted',
              execution_id: executionId,
            });
          } catch (restartError: any) {
            console.error('[Cadence] Error restarting execution:', restartError);
            await supabase
              .from('cadence_executions')
              .update({ 
                status: 'error',
                metadata: {
                  ...execution.metadata,
                  error: restartError.message,
                }
              })
              .eq('id', executionId);
            
      // Check if it's a scope-related error
      const isScopeError = restartError.message?.includes('missing required scope') ||
                          restartError.message?.includes('insufficient authentication scopes') ||
                          restartError.message?.includes('OAuth token missing required scope') ||
                          restartError.message?.includes('Token missing required scope') ||
                          restartError.message?.includes('gmail.send');
      
      return NextResponse.json({
        success: false,
        error: `Failed to restart execution: ${restartError.message}`,
        execution_id: executionId,
        isScopeError, // Flag to help frontend detect scope errors
      }, { status: isScopeError ? 403 : 500 });
          }
        }
        return NextResponse.json({
          success: true,
          message: 'Cadence restarted',
          execution_id: executionId,
        });
      }
    }

    // Get blocks from cadence
    const blocks = (cadence.nodes || []) as FlowBlock[];
    if (!blocks || blocks.length === 0) {
      return NextResponse.json(
        { error: 'Cadence has no blocks' },
        { status: 400 }
      );
    }

    // Start workflow execution
    const { companyCadenceId, executionId } = await startWorkflowExecution(
      supabase,
      companyCadence.company_id,
      companyCadence.cadence_id,
      blocks
    );

    // Update company_cadence status to active
    await supabase
      .from('company_cadences')
      .update({ status: 'active' })
      .eq('id', company_cadence_id);

    // Start executing the workflow
    const execution = await getExecution(supabase, executionId);
    if (!execution) {
      return NextResponse.json(
        { error: 'Failed to create execution' },
        { status: 500 }
      );
    }

    // Execute first block after trigger
    try {
      await executeNextBlock(supabase, execution, blocks);
      console.log(`[Cadence] Successfully executed first block for cadence ${cadence.id}`);
    } catch (execError: any) {
      console.error('[Cadence] Error executing first block:', execError);
      // Mark execution as error but don't fail the request
      await supabase
        .from('cadence_executions')
        .update({ 
          status: 'error',
          metadata: {
            ...execution.metadata,
            error: execError.message,
          }
        })
        .eq('id', executionId);
      
      // Check if it's a scope-related error
      const isScopeError = execError.message?.includes('missing required scope') ||
                          execError.message?.includes('insufficient authentication scopes') ||
                          execError.message?.includes('OAuth token missing required scope') ||
                          execError.message?.includes('Token missing required scope') ||
                          execError.message?.includes('gmail.send');
      
      return NextResponse.json({
        success: false,
        error: `Failed to execute workflow: ${execError.message}`,
        execution_id: executionId,
        isScopeError, // Flag to help frontend detect scope errors
      }, { status: isScopeError ? 403 : 500 });
    }

    return NextResponse.json({
      success: true,
      company_cadence_id: companyCadenceId,
      execution_id: executionId,
    });
  } catch (error: any) {
    console.error('Error starting workflow:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to start workflow' },
      { status: 500 }
    );
  }
}

