import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { sendVoicemail } from '@/lib/services/vapi';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone_number, script, company_id, cadence_id } = body;

    // Validate required fields
    if (!phone_number || !script || !company_id) {
      return NextResponse.json(
        { error: 'phone_number, script, and company_id are required' },
        { status: 400 }
      );
    }

    // Create server-side Supabase client
    const supabase = await createServerSupabaseClient();
    
    // Get user session to verify authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Send voicemail via VAPI
    const { callId, status } = await sendVoicemail({
      phoneNumber: phone_number,
      script,
      companyId: company_id,
      cadenceId: cadence_id,
    });

    // Log voicemail to company_content table (for backward compatibility)
    const { data: contentLog, error: logError } = await supabase
      .from('company_content')
      .insert({
        company_id,
        content_type: 'outreach_log',
        content: `Voicemail left: ${script.substring(0, 100)}...`,
        source: 'CRM Cadence',
        metadata: {
          cadence_id: cadence_id || null,
          vapi_call_id: callId,
          vapi_status: status,
          phone_number: phone_number,
          script: script,
        },
      })
      .select()
      .single();

    if (logError) {
      console.error('Error logging voicemail to company_content:', logError);
    }

    // Also log to call_logs table
    const { error: callLogError } = await supabase
      .from('call_logs')
      .insert({
        company_id,
        cadence_id: cadence_id || null,
        call_type: 'voicemail',
        direction: 'outbound',
        phone_number: phone_number,
        vapi_call_id: callId,
        status: status,
        notes: script, // Store script as notes
        metadata: {
          cadence_id: cadence_id || null,
          script: script,
        },
      });

    if (callLogError) {
      console.error('Error logging voicemail to call_logs:', callLogError);
      // Still return success since voicemail was sent
    }

    return NextResponse.json({
      success: true,
      callId,
      status,
      contentLog,
    });
  } catch (error: any) {
    console.error('Error sending voicemail:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send voicemail' },
      { status: 500 }
    );
  }
}

