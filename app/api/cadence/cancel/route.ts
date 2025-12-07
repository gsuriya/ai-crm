import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { companyCadenceId } = await request.json();

    if (!companyCadenceId) {
      return NextResponse.json({ error: 'Company cadence ID is required' }, { status: 400 });
    }

    const { data: execution } = await supabase
      .from('cadence_executions')
      .select('metadata')
      .eq('company_cadence_id', companyCadenceId)
      .single();

    const updatedMetadata = {
      ...(execution?.metadata || {}),
      cancelled_reason: 'manually_cancelled',
      cancelled_at: new Date().toISOString()
    };

    const { error: ceError } = await supabase
      .from('cadence_executions')
      .update({ 
        status: 'completed',
        metadata: updatedMetadata
      })
      .eq('company_cadence_id', companyCadenceId);

    if (ceError) throw ceError;

    const { error: ccError } = await supabase
      .from('company_cadences')
      .update({ status: 'completed' })
      .eq('id', companyCadenceId);

    if (ccError) throw ccError;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error cancelling cadence:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
