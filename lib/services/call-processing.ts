/**
 * Call processing services
 * Handles call transcript summarization and financial extraction
 */

import OpenAI from 'openai';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.warn('OPENAI_API_KEY not set - call processing features will be limited');
}

const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

/**
 * Generate a concise call summary from transcription
 */
export async function generateCallSummary(
  transcription: string,
  companyId: string
): Promise<string> {
  if (!openai) {
    // Fallback: return first 500 chars
    return transcription.substring(0, 500) + (transcription.length > 500 ? '...' : '');
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an expert at organizing call notes. Create a well-structured, professional summary that includes:

1. **Meeting Scheduled**: Date, time, and any details
2. **Key Discussion Points**: Main topics discussed
3. **Financial Information**: Any metrics shared (ARR, growth, etc.)
4. **Next Steps**: Action items or follow-ups
5. **Additional Context**: Any other relevant information

Format it clearly with sections. Keep it concise but comprehensive.`,
        },
        {
          role: 'user',
          content: `Organize and improve these call notes based on this transcript:\n\n${transcription}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    return response.choices[0]?.message?.content?.trim() || transcription.substring(0, 500);
  } catch (error) {
    console.error('Error generating call summary:', error);
    return transcription.substring(0, 500) + (transcription.length > 500 ? '...' : '');
  }
}

/**
 * Extract financial information from call transcript
 */
export async function extractFinancialsFromTranscript(
  transcription: string,
  companyId: string
): Promise<{
  arr?: number;
  gross_retention?: number;
  net_retention?: number;
  gross_margin?: number;
  ebitda?: number;
  month?: number;
  year?: number;
} | null> {
  if (!openai) {
    return null;
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a financial data extraction expert. Extract financial metrics mentioned in the call transcript.

Extract ONLY if explicitly mentioned:
- ARR (Annual Recurring Revenue) - convert to number (e.g., "$5M" or "5 million" = 5000000, "$500K" = 500000)
- Gross Retention Rate - as a percentage (0-200)
- Net Retention Rate - as a percentage (0-300)
- Gross Margin - as a percentage (-100 to 100)
- EBITDA - as a number

Also extract:
- Month (1-12) if mentioned (default to current month if not specified)
- Year (default to current year if not specified)

Return ONLY valid JSON with these fields. Use lowercase keys: "arr", "gross_retention", etc. If a metric isn't mentioned, don't include it.`,
        },
        {
          role: 'user',
          content: `Extract financial metrics from this call transcript:\n\n${transcription}\n\nCurrent date: ${new Date().toISOString()}`,
        },
      ],
      temperature: 0.1,
      max_tokens: 300,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    const extracted = JSON.parse(content);

    // Validate and normalize the data
    const result: any = {};

    // Handle ARR - can be string like "5M" or number
    if (extracted.arr !== undefined) {
      if (typeof extracted.arr === 'string') {
        const arrStr = extracted.arr.toLowerCase().replace(/[^0-9.]/g, '');
        const multiplier = extracted.arr.toLowerCase().includes('m') ? 1000000 : 
                         extracted.arr.toLowerCase().includes('k') ? 1000 : 1;
        result.arr = parseFloat(arrStr) * multiplier;
      } else if (typeof extracted.arr === 'number') {
        result.arr = extracted.arr;
      }
    }

    if (extracted.gross_retention !== undefined && typeof extracted.gross_retention === 'number') {
      result.gross_retention = Math.min(200, Math.max(0, extracted.gross_retention));
    }

    if (extracted.net_retention !== undefined && typeof extracted.net_retention === 'number') {
      result.net_retention = Math.min(300, Math.max(0, extracted.net_retention));
    }

    if (extracted.gross_margin !== undefined && typeof extracted.gross_margin === 'number') {
      result.gross_margin = Math.min(100, Math.max(-100, extracted.gross_margin));
    }

    if (extracted.ebitda !== undefined && typeof extracted.ebitda === 'number') {
      result.ebitda = extracted.ebitda;
    }

    if (extracted.month !== undefined && typeof extracted.month === 'number' && extracted.month >= 1 && extracted.month <= 12) {
      result.month = extracted.month;
    } else {
      result.month = new Date().getMonth() + 1;
    }

    if (extracted.year !== undefined && typeof extracted.year === 'number') {
      result.year = extracted.year;
    } else {
      result.year = new Date().getFullYear();
    }

    return Object.keys(result).length > 0 ? result : null;
  } catch (error) {
    console.error('Error extracting financials:', error);
    return null;
  }
}

