import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function extractAndUpdate() {
  // Get most recent call
  const { data: calls } = await supabase
    .from('call_logs')
    .select('*, companies(id, name)')
    .order('created_at', { ascending: false })
    .limit(1);

  if (!calls || calls.length === 0) {
    console.log('No calls found');
    return;
  }

  const call = calls[0];
  const company = call.companies as any;
  
  if (!call.transcription) {
    console.log('No transcription found');
    return;
  }

  console.log(`\n📞 Processing call for: ${company.name}`);
  console.log(`Company ID: ${call.company_id}\n`);

  // Extract financials using GPT
  console.log('🔍 Extracting financials from transcript...');
  try {
    const financialResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a financial data extraction expert. Extract financial metrics mentioned in the call transcript.

Extract ONLY if explicitly mentioned:
- ARR (Annual Recurring Revenue) - convert to number (e.g., "$5M" or "5 million" = 5000000)
- Gross Retention Rate - as a percentage (0-200)
- Net Retention Rate - as a percentage (0-300)
- Gross Margin - as a percentage (-100 to 100)
- EBITDA - as a number

Also extract:
- Month (1-12) if mentioned (default to current month if not specified)
- Year (default to current year if not specified)

Return ONLY valid JSON with these fields. If a metric isn't mentioned, don't include it.`,
        },
        {
          role: 'user',
          content: `Extract financial metrics from this call transcript:\n\n${call.transcription}\n\nCurrent date: ${new Date().toISOString()}`,
        },
      ],
      temperature: 0.1,
      max_tokens: 300,
      response_format: { type: 'json_object' },
    });

    const financialContent = financialResponse.choices[0]?.message?.content;
    if (financialContent) {
      const extracted = JSON.parse(financialContent);
      console.log('✅ Extracted financials:', JSON.stringify(extracted, null, 2));

      // Normalize ARR (handle "5M" = 5000000, etc.)
      if (extracted.arr) {
        if (typeof extracted.arr === 'string') {
          const arrStr = extracted.arr.toLowerCase().replace(/[^0-9.]/g, '');
          const multiplier = extracted.arr.toLowerCase().includes('m') ? 1000000 : 
                           extracted.arr.toLowerCase().includes('k') ? 1000 : 1;
          extracted.arr = parseFloat(arrStr) * multiplier;
        }
      }

      // Update company_financials
      const now = new Date();
      const year = extracted.year || now.getFullYear();
      const month = extracted.month || now.getMonth() + 1;

      const { data: existing } = await supabase
        .from('company_financials')
        .select('*')
        .eq('company_id', call.company_id)
        .eq('year', year)
        .eq('month', month)
        .maybeSingle();

      const financialData: any = {
        company_id: call.company_id,
        year,
        month,
        updated_at: new Date().toISOString(),
      };

      if (extracted.arr !== undefined) financialData.arr = extracted.arr;
      if (extracted.gross_retention !== undefined) financialData.gross_retention = Math.min(200, Math.max(0, extracted.gross_retention));
      if (extracted.net_retention !== undefined) financialData.net_retention = Math.min(300, Math.max(0, extracted.net_retention));
      if (extracted.gross_margin !== undefined) financialData.gross_margin = Math.min(100, Math.max(-100, extracted.gross_margin));
      if (extracted.ebitda !== undefined) financialData.ebitda = extracted.ebitda;

      if (existing) {
        await supabase
          .from('company_financials')
          .update(financialData)
          .eq('id', existing.id);
        console.log('✅ Updated existing financial record');
      } else {
        await supabase
          .from('company_financials')
          .insert(financialData);
        console.log('✅ Created new financial record');
      }

      // Update call_logs metadata
      await supabase
        .from('call_logs')
        .update({
          metadata: {
            ...(call.metadata || {}),
            extracted_financials: extracted,
            financials_extracted_at: new Date().toISOString(),
          },
        })
        .eq('id', call.id);
    }
  } catch (error: any) {
    console.error('❌ Error extracting financials:', error.message);
  }

  // Improve notes organization using GPT
  console.log('\n📝 Organizing notes...');
  try {
    const notesResponse = await openai.chat.completions.create({
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
          content: `Organize and improve these call notes based on this transcript:\n\nTranscript:\n${call.transcription}\n\nCurrent Notes:\n${call.notes || 'None'}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    const improvedNotes = notesResponse.choices[0]?.message?.content?.trim();
    if (improvedNotes) {
      console.log('✅ Improved notes:\n', improvedNotes);

      // Update call_logs with improved notes
      await supabase
        .from('call_logs')
        .update({ notes: improvedNotes })
        .eq('id', call.id);

      // Also update company_content
      const { data: existingContent } = await supabase
        .from('company_content')
        .select('id')
        .eq('company_id', call.company_id)
        .eq('content_type', 'note')
        .eq('source', 'vapi_call')
        .contains('metadata', { call_log_id: call.id })
        .limit(1);

      if (existingContent && existingContent.length > 0) {
        await supabase
          .from('company_content')
          .update({ content: improvedNotes })
          .eq('id', existingContent[0].id);
      } else {
        await supabase
          .from('company_content')
          .insert({
            company_id: call.company_id,
            content_type: 'note',
            content: improvedNotes,
            source: 'vapi_call',
            metadata: {
              call_log_id: call.id,
              vapi_call_id: call.vapi_call_id,
              call_type: call.call_type,
              phone_number: call.phone_number,
              created_at: call.created_at,
            },
          });
      }

      console.log('✅ Updated notes in database');
    }
  } catch (error: any) {
    console.error('❌ Error organizing notes:', error.message);
  }

  console.log('\n✅ Done!\n');
}

extractAndUpdate().catch(console.error);

