import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { sendVoiceCall } from '@/lib/services/vapi';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone_number, company_id, cadence_id, company_name, custom_prompt, voicemail_message, enable_voicemail_fallback } = body;

    // Validate required fields
    if (!phone_number || !company_id) {
      return NextResponse.json(
        { error: 'phone_number and company_id are required' },
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

    // Get company name if not provided
    let companyName = company_name;
    if (!companyName) {
      const { data: company } = await supabase
        .from('companies')
        .select('name')
        .eq('id', company_id)
        .single();
      
      companyName = company?.name;
    }

    // Send voice call via VAPI
    const { callId, status } = await sendVoiceCall({
      phoneNumber: phone_number,
      companyId: company_id,
      cadenceId: cadence_id,
      companyName: companyName,
      customPrompt: custom_prompt,
      voicemailMessage: voicemail_message,
      enableVoicemailFallback: enable_voicemail_fallback !== false, // Default to true
    });

    // Log voice call to company_content table (for backward compatibility)
    const { data: contentLog, error: logError } = await supabase
      .from('company_content')
      .insert({
        company_id,
        content_type: 'outreach_log',
        content: `Voice call initiated: AI agent call to schedule meeting`,
        source: 'CRM Cadence',
        metadata: {
          cadence_id: cadence_id || null,
          vapi_call_id: callId,
          vapi_status: status,
          phone_number: phone_number,
          call_type: 'voice_call',
          company_name: companyName,
        },
      })
      .select()
      .single();

    if (logError) {
      console.error('Error logging voice call to company_content:', logError);
    }

    // Also log to call_logs table
    const { error: callLogError } = await supabase
      .from('call_logs')
      .insert({
        company_id,
        cadence_id: cadence_id || null,
        call_type: 'voice_call',
        direction: 'outbound',
        phone_number: phone_number,
        vapi_call_id: callId,
        status: status,
        metadata: {
          cadence_id: cadence_id || null,
          company_name: companyName,
          custom_prompt: custom_prompt || null,
        },
      });

    if (callLogError) {
      console.error('Error logging voice call to call_logs:', callLogError);
      // Still return success since call was initiated
    }

    return NextResponse.json({
      success: true,
      callId,
      status,
      contentLog,
    });
  } catch (error: any) {
    console.error('Error sending voice call:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send voice call' },
      { status: 500 }
    );
  }
}

