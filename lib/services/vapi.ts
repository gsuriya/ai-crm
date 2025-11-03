import { VapiClient } from '@vapi-ai/server-sdk';
import { supabase } from '@/lib/supabase';

/**
 * Send voicemail via VAPI
 */
export interface SendVoicemailParams {
  phoneNumber: string;
  script: string;
  companyId: string;
  cadenceId?: string;
}

export interface VAPIVoicemailResponse {
  callId: string;
  status: string;
}

/**
 * Send voicemail via VAPI SDK (matching surveilens implementation)
 */
export async function sendVoicemail(
  params: SendVoicemailParams
): Promise<VAPIVoicemailResponse> {
  const privateKey = process.env.VAPI_PRIVATE_KEY || process.env.VAPI_API_KEY;
  if (!privateKey) {
    throw new Error('VAPI_PRIVATE_KEY or VAPI_API_KEY environment variable is not set');
  }

  const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID;
  if (!phoneNumberId) {
    throw new Error('VAPI_PHONE_NUMBER_ID environment variable is not set. Please add a phone number in VAPI dashboard.');
  }

  const assistantId = process.env.VAPI_ASSISTANT_ID || '11182291-6fa9-46d2-8127-5a8b4536e00e';

  try {
    // Initialize VAPI SDK client (same as surveilens)
    const vapi = new VapiClient({
      token: privateKey,
    });

    // Make the call using outbound phone call (matching surveilens implementation)
    const call = await vapi.calls.create({
      type: 'outboundPhoneCall',
      phoneNumberId: phoneNumberId,
      customer: {
        number: params.phoneNumber,
      },
      assistantId: assistantId,
      // Override assistant's default message with custom script
      assistantOverrides: {
        firstMessage: params.script,
      },
    });

    return {
      callId: call.id || '',
      status: call.status || 'initiated',
    };
  } catch (error: any) {
    console.error('VAPI call error:', error);
    
    // Handle specific VAPI SDK errors
    if (error.statusCode === 400) {
      throw new Error(`Bad request - check phone number format or configuration: ${error.body || error.message}`);
    }
    
    if (error.statusCode === 401) {
      throw new Error('Unauthorized - check VAPI credentials');
    }
    
    throw new Error(`Failed to initiate call: ${error.message || String(error)}`);
  }
}

/**
 * Get voicemail status from VAPI
 */
export async function getVoicemailStatus(callId: string): Promise<any> {
  const privateKey = process.env.VAPI_PRIVATE_KEY || process.env.VAPI_API_KEY;
  if (!privateKey) {
    throw new Error('VAPI_PRIVATE_KEY or VAPI_API_KEY environment variable is not set');
  }

  try {
    const vapi = new VapiClient({
      token: privateKey,
    });

    const call = await vapi.calls.get(callId);
    return call;
  } catch (error: any) {
    console.error('VAPI get call error:', error);
    throw new Error(`Failed to get call status: ${error.message || String(error)}`);
  }
}

