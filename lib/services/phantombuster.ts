/**
 * Phantombuster LinkedIn Message Service
 * Sends LinkedIn DMs using Phantombuster API
 */

const PHANTOMBUSTER_API_KEY = process.env.PHANTOMBUSTER_API_KEY;
const PHANTOMBUSTER_LINKEDIN_MESSAGE_PHANTOM_ID = process.env.PHANTOMBUSTER_LINKEDIN_MESSAGE_PHANTOM_ID;

export interface SendLinkedInMessageParams {
  linkedinProfileUrl: string;
  message: string;
  contactName?: string;
}

export interface PhantombusterResponse {
  success: boolean;
  output?: any;
  error?: string;
  containerId?: string;
}

/**
 * Send a LinkedIn message using Phantombuster
 * 
 * @param params - Message parameters including LinkedIn profile URL and message content
 * @returns Response with success status and output/error
 */
export async function sendLinkedInMessage(
  params: SendLinkedInMessageParams
): Promise<PhantombusterResponse> {
  if (!PHANTOMBUSTER_API_KEY) {
    throw new Error('PHANTOMBUSTER_API_KEY not configured. Set it in environment variables.');
  }

  if (!PHANTOMBUSTER_LINKEDIN_MESSAGE_PHANTOM_ID) {
    throw new Error('PHANTOMBUSTER_LINKEDIN_MESSAGE_PHANTOM_ID not configured. Set it in environment variables.');
  }

  try {
    // Phantombuster API endpoint for launching a phantom
    const apiUrl = `https://api.phantombuster.com/api/v2/agents/launch`;
    
    // Prepare the input CSV data (Phantombuster expects CSV format)
    // Format: linkedinUrl,message
    const csvData = `linkedinUrl,message\n"${params.linkedinProfileUrl}","${params.message.replace(/"/g, '""')}"`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Phantombuster-Key': PHANTOMBUSTER_API_KEY,
      },
      body: JSON.stringify({
        id: PHANTOMBUSTER_LINKEDIN_MESSAGE_PHANTOM_ID,
        argument: {
          csvInput: csvData,
          message: params.message,
          // Optional: Add delay between messages if sending multiple
          numberOfLinesPerLaunch: 1,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('[Phantombuster] API error:', errorData);
      return {
        success: false,
        error: errorData.error || `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const data = await response.json();
    
    return {
      success: true,
      output: data,
      containerId: data.containerId,
    };
  } catch (error: any) {
    console.error('[Phantombuster] Error sending LinkedIn message:', error);
    return {
      success: false,
      error: error.message || 'Unknown error occurred',
    };
  }
}

/**
 * Check the status of a Phantombuster container
 * 
 * @param containerId - The container ID from the launch response
 * @returns Status information
 */
export async function checkPhantombusterStatus(
  containerId: string
): Promise<{ status: string; output?: any; error?: string }> {
  if (!PHANTOMBUSTER_API_KEY) {
    throw new Error('PHANTOMBUSTER_API_KEY not configured');
  }

  try {
    const response = await fetch(
      `https://api.phantombuster.com/api/v2/containers/fetch-output?id=${containerId}`,
      {
        headers: {
          'X-Phantombuster-Key': PHANTOMBUSTER_API_KEY,
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      return {
        status: 'error',
        error: errorData.error || `HTTP ${response.status}`,
      };
    }

    const data = await response.json();
    return {
      status: data.status || 'unknown',
      output: data.output,
    };
  } catch (error: any) {
    return {
      status: 'error',
      error: error.message,
    };
  }
}

