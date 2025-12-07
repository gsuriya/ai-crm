import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { companyCadenceId } = await request.json();

    if (!companyCadenceId) {
      return NextResponse.json({ error: 'Company cadence ID is required' }, { status: 400 });
    }

    // Get the execution to update metadata
    const { data: execution } = await supabase
      .from('cadence_executions')
      .select('metadata, scheduled_for')
      .eq('company_cadence_id', companyCadenceId)
      .single();

    if (!execution) {
      return NextResponse.json({ error: 'Execution not found' }, { status: 404 });
    }

    // Remove paused_reason and paused_at from metadata
    const updatedMetadata = { ...(execution.metadata || {}) };
    delete updatedMetadata.paused_reason;
    delete updatedMetadata.paused_at;

    // Update execution status back to active
    const { error: ceError } = await supabase
      .from('cadence_executions')
      .update({ 
        status: 'active',
        metadata: updatedMetadata,
        // If there was no scheduled_for, set it to now to continue processing
        scheduled_for: execution.scheduled_for || new Date().toISOString()
      })
      .eq('company_cadence_id', companyCadenceId);

    if (ceError) throw ceError;

    // Update company_cadence status
    const { error: ccError } = await supabase
      .from('company_cadences')
      .update({ status: 'active' })
      .eq('id', companyCadenceId);

    if (ccError) throw ccError;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error resuming cadence:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
