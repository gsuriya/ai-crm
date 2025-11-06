import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { sendVoiceCall } from '@/lib/services/vapi';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone_number, company_id, cadence_id, company_name, custom_prompt, voicemail_message, enable_voicemail_fallback } = body;

    console.log('[API /voice-call/send] ====== REQUEST RECEIVED ======');
    console.log('[API /voice-call/send] Phone number:', phone_number);
    console.log('[API /voice-call/send] Phone number length:', phone_number?.length || 0);
    console.log('[API /voice-call/send] Phone number type:', typeof phone_number);
    console.log('[API /voice-call/send] Company ID:', company_id);
    console.log('[API /voice-call/send] Cadence ID:', cadence_id);
    console.log('[API /voice-call/send] ===============================');

    // Validate required fields
    if (!phone_number || !company_id) {
      console.error('[API /voice-call/send] Missing required fields:', {
        has_phone: !!phone_number,
        has_company_id: !!company_id,
      });
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

    // Trim and validate phone number
    const cleanPhoneNumber = String(phone_number || '').trim();
    console.log('[API /voice-call/send] ====== CALLING VAPI ======');
    console.log('[API /voice-call/send] Clean phone number:', cleanPhoneNumber);
    console.log('[API /voice-call/send] Digits only:', cleanPhoneNumber.replace(/\D/g, ''));
    console.log('[API /voice-call/send] Length:', cleanPhoneNumber.length);

    // Send voice call via VAPI with cleaned phone number
    console.log('[API /voice-call/send] Sending to VAPI service...');
    const { callId, status } = await sendVoiceCall({
      phoneNumber: cleanPhoneNumber, // Use cleaned phone number
      companyId: company_id,
      cadenceId: cadence_id,
      companyName: companyName,
      customPrompt: custom_prompt,
      voicemailMessage: voicemail_message,
      enableVoicemailFallback: enable_voicemail_fallback !== false, // Default to true
    });

    console.log('[API /voice-call/send] ====== VAPI CALL SUCCESSFUL ======');
    console.log('[API /voice-call/send] Call ID:', callId);
    console.log('[API /voice-call/send] Status:', status);
    console.log('[API /voice-call/send] Phone called:', cleanPhoneNumber);
    console.log('[API /voice-call/send] ===================================');

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
    console.error('[API /voice-call/send] ====== ERROR ======');
    console.error('[API /voice-call/send] Error message:', error.message);
    console.error('[API /voice-call/send] Error stack:', error.stack);
    console.error('[API /voice-call/send] Full error:', error);
    console.error('[API /voice-call/send] ===================');
    
    const errorMessage = error.message || error.toString() || 'Failed to send voice call';
    return NextResponse.json(
      { 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

