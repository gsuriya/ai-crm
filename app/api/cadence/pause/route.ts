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
      paused_reason: 'manually_paused',
      paused_at: new Date().toISOString()
    };

    const { error: ceError } = await supabase
      .from('cadence_executions')
      .update({ 
        status: 'paused',
        metadata: updatedMetadata
      })
      .eq('company_cadence_id', companyCadenceId);

    if (ceError) throw ceError;

    const { error: ccError } = await supabase
      .from('company_cadences')
      .update({ status: 'paused' })
      .eq('id', companyCadenceId);

    if (ccError) throw ccError;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error pausing cadence:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
