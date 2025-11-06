import { VapiClient } from '@vapi-ai/server-sdk';
import { supabase } from '@/lib/supabase';

/**
 * Normalize phone number to E.164 format required by VAPI
 * Converts formats like "630-853-9929" or "(630) 853-9929" to "+16308539929"
 */
function normalizePhoneNumber(phone: string): string {
  if (!phone) return phone;
  
  // Remove all non-digit characters
  const digitsOnly = phone.replace(/\D/g, '');
  
  // If it's a 10-digit US number, add +1 prefix
  if (digitsOnly.length === 10) {
    return `+1${digitsOnly}`;
  }
  
  // If it already starts with 1 and has 11 digits, add + prefix
  if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
    return `+${digitsOnly}`;
  }
  
  // If it already starts with +1, return as is (remove any formatting)
  if (phone.startsWith('+1') || phone.startsWith('+1 ')) {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+${cleaned}`;
    }
    return phone; // Already formatted correctly
  }
  
  // If it starts with +, assume it's already formatted
  if (phone.startsWith('+')) {
    return phone;
  }
  
  console.warn(`[VAPI] Could not normalize phone number: ${phone}, using as-is`);
  return phone;
}

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

      // Normalize phone number to E.164 format
      const normalizedPhoneNumber = normalizePhoneNumber(params.phoneNumber);
      console.log(`[VAPI] Voicemail phone normalization: "${params.phoneNumber}" -> "${normalizedPhoneNumber}"`);

      // Make the call using outbound phone call (matching surveilens implementation)
      const call = await vapi.calls.create({
        type: 'outboundPhoneCall',
        phoneNumberId: phoneNumberId,
        customer: {
          number: normalizedPhoneNumber,
        },
        assistantId: assistantId,
        // Override assistant's default message with custom script
        assistantOverrides: {
          firstMessage: params.script,
        },
      } as any);

    // Handle both single call and batch responses
    const callId = (call as any).id || (call as any).calls?.[0]?.id || '';
    const status = (call as any).status || (call as any).calls?.[0]?.status || 'initiated';
    
    return {
      callId,
      status,
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

/**
 * System prompt for voice call AI agent
 * 
 * NOTE: This prompt should be configured in the VAPI dashboard for the assistant.
 * This constant is for reference/documentation only.
 */
const VOICE_CALL_SYSTEM_PROMPT = `You are an AI Agent calling from Insight Partners on behalf of Pranav Srigiriraju. Your goal is to schedule a meeting with the founder/decision maker.

IMPORTANT :
IF  THEY AGREE TO A CALL, ask if there is any financial or non-financial information you'd like to include as context before the call?"

- If they ask why you're asking, simply say: "Just asking in case it's helpful" and don't press further
- If they seem annoyed or angry, immediately move on - don't press
- Record any information they share (financial metrics, company updates, etc.) and make sure to include it in your notes/summary after the call
- If they provide financial information (ARR, retention rates, margins, etc.), make sure to mention the specific numbers clearly in the conversation

Your main introduction should be:
"Hey, I'm an AI Agent calling from Insight Partners on behalf of Pranav Srigiriraju. He's been trying to get in contact with you because we're super excited about your company, and I'm wondering if you'd be open to a chat sometime in the next week or so."

Key guidelines:
1. Try to set up a meeting whenever the founder might be free in the next week
2. If they say no, politely accept and end the conversation - don't push or be aggressive
3. If they press you for details about the firm or investment details, say: "I don't want to say incorrect things about the firm, and it'd be much easier to hop on a call with one of our investors like Pranav who would be more than happy to explain everything."
4. If they ask questions about financials, investment terms, or anything else you're not equipped to answer, say: "I'm not a financial expert or really here to answer any questions. My job is really just to set up a call since Insight Partners is very interested in your business, and my job is to get you in touch with us and provide the investor any helpful info."
5. Be professional, friendly, and concise
6. Focus on scheduling a meeting - that's your primary objective
7. If they ask questions you can't answer accurately, redirect them to scheduling a call with Pranav
8. When recording information in your notes, be specific about numbers, dates, and metrics mentioned
9. IF THEY SAY DON'T CONTACT ME OR I'M NOT INTERESTED, SAY SORRY FOR THE INCONVENIENCE AND END THE CALL
10. If they say "I'm busy now, call me later" or anything like that about delaying this, try to ask for a specific time that works better. If they give you one, say you'll relay the info and thanks for the time`;

/**
 * Default voicemail message for when calls aren't answered
 */
const DEFAULT_VOICEMAIL_MESSAGE = `Hey, this is an AI Agent calling on behalf of Insight Partners. Pranav Srigiriraju, one of our investors, is highly interested in your company and would love to chat. Please feel free to call him back at 630-853-9929 or shoot him an email at pss9179@stern.nyu.edu so we can set up a meeting and introduce you to the firm. Thanks for your time!`;

/**
 * Send voice call via VAPI (two-way conversation)
 */
export interface SendVoiceCallParams {
  phoneNumber: string;
  companyId: string;
  cadenceId?: string;
  companyName?: string;
  customPrompt?: string; // Optional custom system prompt
  voicemailMessage?: string; // Optional custom voicemail message (if call goes to voicemail)
  enableVoicemailFallback?: boolean; // Whether to leave voicemail if not answered (default: true)
}

export interface VAPIVoiceCallResponse {
  callId: string;
  status: string;
}

/**
 * Send voice call via VAPI SDK (two-way conversation with AI agent)
 */
export async function sendVoiceCall(
  params: SendVoiceCallParams
): Promise<VAPIVoiceCallResponse> {
  const privateKey = process.env.VAPI_PRIVATE_KEY || process.env.VAPI_API_KEY;
  if (!privateKey) {
    throw new Error('VAPI_PRIVATE_KEY or VAPI_API_KEY environment variable is not set');
  }

  const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID;
  if (!phoneNumberId) {
    throw new Error('VAPI_PHONE_NUMBER_ID environment variable is not set. Please add a phone number in VAPI dashboard.');
  }

  const assistantId = process.env.VAPI_ASSISTANT_ID || '11182291-6fa9-46d2-8127-5a8b4536e00e';

  // Normalize phone number to E.164 format
  const originalPhoneNumber = params.phoneNumber;
  const normalizedPhoneNumber = normalizePhoneNumber(params.phoneNumber);
  
  console.log(`[VAPI] Phone number normalization: "${originalPhoneNumber}" -> "${normalizedPhoneNumber}"`);
  
  if (!normalizedPhoneNumber || !normalizedPhoneNumber.startsWith('+')) {
    throw new Error(`Invalid phone number format: "${params.phoneNumber}". Phone numbers must be in E.164 format (e.g., +16308539929)`);
  }

  // Build assistant overrides object - only include fields if we need to override
  const assistantOverrides: any = {};

  // NOTE: System prompt cannot be overridden via assistantOverrides
  // It must be configured in the VAPI dashboard for the assistant
  // The VOICE_CALL_SYSTEM_PROMPT constant is for reference/documentation only
  // If you want to use a custom system prompt, configure it in VAPI dashboard or use a different assistant

  // Create a personalized first message if company name is provided
  // Otherwise, let it use the default from VAPI dashboard
  if (params.companyName) {
    assistantOverrides.firstMessage = `Hey, I'm an AI Agent calling from Insight Partner on behalf of Pranav Srigiriraju. He's been trying to get in contact with you about ${params.companyName} because we're super excited about your company, and I'm wondering if you'd be open to a chat sometime in the next week or so.`;
  }

  // Configure voicemail fallback (default: enabled)
  const enableVoicemail = params.enableVoicemailFallback !== false; // Default to true
  const voicemailMessage = params.voicemailMessage || DEFAULT_VOICEMAIL_MESSAGE;

  // Add voicemail configuration to assistant overrides
  if (enableVoicemail) {
    assistantOverrides.voicemailMessage = voicemailMessage;
  }

  try {
    // Initialize VAPI SDK client
    const vapi = new VapiClient({
      token: privateKey,
    });

    // Make the call using outbound phone call
    // phoneNumberId = Your caller ID number (630-853-9929) - set in VAPI dashboard and env var VAPI_PHONE_NUMBER_ID
    // customer.number = The contact's phone number being called (from cadence)
    const callOptions: any = {
      type: 'outboundPhoneCall',
      phoneNumberId: phoneNumberId, // YOUR number (caller ID) - from env var
      customer: {
        number: normalizedPhoneNumber, // CONTACT's number (being called) - from cadence contact
      },
      assistantId: assistantId,
    };
    
    console.log(`[VAPI] 📞 Call setup:`);
    console.log(`[VAPI]   - From (caller ID): phoneNumberId ${phoneNumberId} (your number: 630-853-9929)`);
    console.log(`[VAPI]   - To (being called): ${normalizedPhoneNumber} (contact's number)`);
    console.log(`[VAPI]   - Assistant ID: ${assistantId}`);

    // Only add overrides if we have any
    if (Object.keys(assistantOverrides).length > 0) {
      callOptions.assistantOverrides = assistantOverrides;
    }

    console.log(`[VAPI] Creating call with options:`, JSON.stringify(callOptions, null, 2));
    const call = await vapi.calls.create(callOptions);

    // Handle both single call and batch responses
    const callId = (call as any).id || (call as any).calls?.[0]?.id || '';
    const status = (call as any).status || (call as any).calls?.[0]?.status || 'initiated';
    
    console.log(`[VAPI] ✅ Call created successfully. Call ID: ${callId}, Status: ${status}`);
    
    return {
      callId,
      status,
    };
  } catch (error: any) {
    console.error('VAPI voice call error:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    
    // Handle specific VAPI SDK errors
    if (error.statusCode === 400) {
      let errorMessage = 'Bad request';
      if (error.body) {
        if (typeof error.body === 'string') {
          errorMessage = error.body;
        } else if (error.body.message) {
          errorMessage = error.body.message;
        } else if (error.body.error) {
          errorMessage = error.body.error;
        } else {
          errorMessage = JSON.stringify(error.body);
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      throw new Error(`Bad request - check phone number format or configuration: ${errorMessage}`);
    }
    
    if (error.statusCode === 401) {
      throw new Error('Unauthorized - check VAPI credentials');
    }
    
    // Better error message extraction
    let errorMessage = 'Unknown error';
    if (error.body) {
      if (typeof error.body === 'string') {
        errorMessage = error.body;
      } else if (error.body.message) {
        errorMessage = error.body.message;
      } else if (error.body.error) {
        errorMessage = error.body.error;
      } else {
        errorMessage = JSON.stringify(error.body);
      }
    } else if (error.message) {
      errorMessage = error.message;
    }
    throw new Error(`Failed to initiate voice call: ${errorMessage}`);
  }
}

