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
    const { data: { session }, error: supabaseSessionError } = await supabase.auth.getSession();
    console.log('[Cadence Start] Session check:', { 
      hasSession: !!session,
      userId: session?.user?.id,
      sessionError: supabaseSessionError?.message 
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
    
    // Check if user has Google OAuth session (required for sending emails)
    const { data: userSession, error: userSessionError } = await supabase
      .from('user_sessions')
      .select('access_token, refresh_token, email')
      .eq('user_id', user.id)
      .single();
    
    if (userSessionError || !userSession || !userSession.access_token) {
      console.error('[Cadence Start] No Google OAuth session found:', userSessionError);
      return NextResponse.json(
        { 
          error: 'No Google OAuth session found. Please sign in with Google and grant Gmail permissions.',
          details: 'Go to /auth/signin and click "Sign in with Google", then grant Gmail permissions.',
          hasSession: !!userSession,
          hasAccessToken: !!userSession?.access_token,
        },
        { status: 403 }
      );
    }
    
    console.log('[Cadence Start] ✅ Google OAuth session found');

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

      // Execute first block after trigger in background
      const execution = await getExecution(supabase, executionId);
      if (execution) {
          console.log('[Cadence Start] 🚀 About to execute first block...');
          console.log('[Cadence Start] Execution details:', {
            id: execution.id,
            current_block_id: execution.current_block_id,
            status: execution.status,
            metadata: execution.metadata,
          });
          console.log('[Cadence Start] Blocks in cadence:', blocks.map(b => ({ id: b.id, type: b.type, title: b.title })));
          
        // Execute in background - don't wait
        (async () => {
          try {
            console.log('[Cadence Start] ⚡ EXECUTING executeNextBlock NOW (restart)...');
          await executeNextBlock(supabase, execution, blocks);
            console.log('[Cadence Start] ✅✅✅ Background execution completed successfully!');
          } catch (error: any) {
            console.error('[Cadence Start] ❌❌❌ CRITICAL ERROR:', error.message);
            console.error('[Cadence Start] Error stack:', error.stack);
          await supabase
            .from('cadence_executions')
            .update({ 
              status: 'error',
              metadata: {
                ...execution.metadata,
                  error: error.message || String(error),
                }
              })
              .eq('id', executionId)
              .catch(console.error);
          }
        })();
        
        console.log('[Cadence Start] ✅ Started execution in background');
          return NextResponse.json({
          success: true,
          message: 'Cadence restarted - running in background',
            execution_id: executionId,
        });
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
          
          // Get updated execution and execute in background
          const updatedExecution = await getExecution(supabase, activeExecution.id);
          if (updatedExecution) {
            (async () => {
              try {
                console.log('[Cadence Start] ⚡ EXECUTING executeNextBlock NOW (reset)...');
                await executeNextBlock(supabase, updatedExecution, blocks);
                console.log('[Cadence Start] ✅✅✅ Background execution completed successfully!');
              } catch (error: any) {
                console.error('[Cadence Start] ❌❌❌ CRITICAL ERROR:', error.message);
                await supabase
                  .from('cadence_executions')
                  .update({ 
                    status: 'error',
                    metadata: {
                      ...updatedExecution.metadata,
                      error: error.message || String(error),
                    }
                  })
                  .eq('id', activeExecution.id)
                  .catch(console.error);
              }
            })();
            return NextResponse.json({
              success: true,
              message: 'Cadence restarted from beginning - running in background',
              execution_id: activeExecution.id,
            });
          }
        }
        
        // Resume existing execution in background
        (async () => {
        try {
            console.log('[Cadence Start] ⚡ EXECUTING executeNextBlock NOW (resume)...');
          await executeNextBlock(supabase, activeExecution as any, blocks);
            console.log('[Cadence Start] ✅✅✅ Background execution completed successfully!');
          } catch (error: any) {
            console.error('[Cadence Start] ❌❌❌ CRITICAL ERROR:', error.message);
          await supabase
            .from('cadence_executions')
            .update({ 
              status: 'error',
              metadata: {
                ...(activeExecution.metadata || {}),
                  error: error.message || String(error),
                }
              })
              .eq('id', activeExecution.id)
              .catch(console.error);
          }
        })();
          return NextResponse.json({
          success: true,
          message: 'Cadence execution resumed - running in background',
            execution_id: activeExecution.id,
        });
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
          (async () => {
            try {
              console.log('[Cadence Start] ⚡ EXECUTING executeNextBlock NOW (fresh start)...');
              await executeNextBlock(supabase, execution, blocks);
              console.log('[Cadence Start] ✅✅✅ Background execution completed successfully!');
            } catch (error: any) {
              console.error('[Cadence Start] ❌❌❌ CRITICAL ERROR:', error.message);
              await supabase
                .from('cadence_executions')
                .update({ 
                  status: 'error',
                  metadata: {
                    ...execution.metadata,
                    error: error.message || String(error),
                  }
                })
                .eq('id', executionId)
                .catch(console.error);
            }
          })();
      return NextResponse.json({
            success: true,
            message: 'Cadence restarted - running in background',
        execution_id: executionId,
          });
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

    // Execute in background - don't wait for it to complete
    // This prevents the API from hanging
    console.log('[Cadence Start] 🚀 Starting execution in background...');
    console.log('[Cadence Start] Execution ID:', executionId);
    console.log('[Cadence Start] Current block ID:', execution.current_block_id);
    console.log('[Cadence Start] Blocks count:', blocks.length);
    console.log('[Cadence Start] Blocks:', blocks.map(b => ({ id: b.id, type: b.type, title: b.title })));
    
    // Wrap in async function to catch all errors
    (async () => {
      try {
        console.log('[Cadence Start] ⚡ EXECUTING executeNextBlock NOW...');
      await executeNextBlock(supabase, execution, blocks);
        console.log('[Cadence Start] ✅✅✅ Background execution completed successfully!');
      } catch (error: any) {
        console.error('[Cadence Start] ❌❌❌ CRITICAL ERROR in background execution:');
        console.error('[Cadence Start] Error message:', error.message);
        console.error('[Cadence Start] Error stack:', error.stack);
        console.error('[Cadence Start] Full error object:', error);
        
        // Mark as error if it fails
        try {
      await supabase
        .from('cadence_executions')
        .update({ 
          status: 'error',
          metadata: {
            ...execution.metadata,
                error: error.message || String(error),
                errorStack: error.stack,
          }
        })
        .eq('id', executionId);
          console.log('[Cadence Start] ✅ Marked execution as error in database');
        } catch (updateError: any) {
          console.error('[Cadence Start] ❌ Failed to update execution status:', updateError);
        }
      }
    })();
    
    // Return immediately - execution runs in background
    console.log(`[Cadence] Started execution for cadence ${cadence.id} - running in background`);

    return NextResponse.json({
      success: true,
      company_cadence_id: companyCadenceId,
      execution_id: executionId,
      message: 'Cadence started - execution is running in background',
    });
  } catch (error: any) {
    console.error('Error starting workflow:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to start workflow' },
      { status: 500 }
    );
  }
}

