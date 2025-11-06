import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { generateCallSummary, extractFinancialsFromTranscript } from '@/lib/services/call-processing';

/**
 * VAPI Webhook Handler
 * Receives call events from VAPI including transcriptions and summaries
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, call } = body;

    console.log('[VAPI Webhook] Received event:', { message, callId: call?.id, status: call?.status });

    // Handle different event types from VAPI
    // VAPI sends different webhook formats, so we need to handle multiple structures
    const callId = call?.id || body.call?.id || body.callId || message?.call?.id;
    const status = call?.status || body.status || message?.call?.status || body.call?.status;
    const transcription = call?.transcript || call?.transcription || body.transcript || body.transcription || message?.call?.transcript;
    const summary = call?.summary || body.summary || message?.call?.summary;
    const recordingUrl = call?.recordingUrl || call?.recording_url || body.recordingUrl || body.recording_url;

    // Process if we have a call ID and the call is ending/completed
    if (!callId) {
      console.warn('[VAPI Webhook] No call ID found in webhook payload');
      return NextResponse.json({ success: true, message: 'No call ID' });
    }

    // Process call completion events
    if (status === 'ended' || status === 'completed' || transcription) {

      const supabase = await createServerSupabaseClient();

      // Find the call log by VAPI call ID
      const { data: callLogs, error: findError } = await supabase
        .from('call_logs')
        .select('*')
        .eq('vapi_call_id', callId)
        .limit(1);

      if (findError) {
        console.error('[VAPI Webhook] Error finding call log:', findError);
        return NextResponse.json({ success: false, error: findError.message }, { status: 500 });
      }

      if (!callLogs || callLogs.length === 0) {
        console.warn('[VAPI Webhook] Call log not found for VAPI call ID:', callId);
        return NextResponse.json({ success: true, message: 'Call log not found' });
      }

      const callLog = callLogs[0];
      const companyId = callLog.company_id;

      // Update call log with transcription and summary
      const updates: any = {
        status: status,
      };

      if (transcription) {
        updates.transcription = transcription;
        
        // Generate summary if not provided by VAPI
        if (!summary && transcription) {
          try {
            const generatedSummary = await generateCallSummary(transcription, companyId);
            updates.notes = generatedSummary;
          } catch (error) {
            console.error('[VAPI Webhook] Error generating summary:', error);
          }
        } else if (summary) {
          updates.notes = summary;
        }

        // Extract financials from transcript
        if (transcription) {
          try {
            const financials = await extractFinancialsFromTranscript(transcription, companyId);
            if (financials && Object.keys(financials).length > 0) {
              // Update company financials
              await updateCompanyFinancials(supabase, companyId, financials);
              updates.metadata = {
                ...(callLog.metadata || {}),
                extracted_financials: financials,
                financials_extracted_at: new Date().toISOString(),
              };
            }
          } catch (error) {
            console.error('[VAPI Webhook] Error extracting financials:', error);
          }
        }
      }

      if (recordingUrl) {
        updates.metadata = {
          ...(updates.metadata || callLog.metadata || {}),
          recording_url: recordingUrl,
        };
      }

      // Update the call log
      const { error: updateError } = await supabase
        .from('call_logs')
        .update(updates)
        .eq('id', callLog.id);

      if (updateError) {
        console.error('[VAPI Webhook] Error updating call log:', updateError);
        return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
      }

      // Also save notes to company_content table (for notes page and semantic search)
      if (updates.notes) {
        try {
          const { error: contentError } = await supabase
            .from('company_content')
            .insert({
              company_id: companyId,
              content_type: 'note',
              content: updates.notes,
              source: 'vapi_call',
              metadata: {
                call_log_id: callLog.id,
                vapi_call_id: callId,
                call_type: callLog.call_type,
                phone_number: callLog.phone_number,
                created_at: new Date().toISOString(),
              },
            });

          if (contentError) {
            console.error('[VAPI Webhook] Error saving note to company_content:', contentError);
            // Don't fail the webhook if this fails, just log it
          } else {
            console.log('[VAPI Webhook] Successfully saved note to company_content');
          }
        } catch (contentErr) {
          console.error('[VAPI Webhook] Error saving note to company_content:', contentErr);
          // Don't fail the webhook if this fails
        }
      }

      console.log('[VAPI Webhook] Successfully updated call log:', callLog.id);
      return NextResponse.json({ success: true, callLogId: callLog.id });
    }

    return NextResponse.json({ success: true, message: 'Event handled' });
  } catch (error: any) {
    console.error('[VAPI Webhook] Error processing webhook:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Update company financials from extracted data
 */
async function updateCompanyFinancials(
  supabase: any,
  companyId: string,
  financials: {
    arr?: number;
    gross_retention?: number;
    net_retention?: number;
    gross_margin?: number;
    ebitda?: number;
    month?: number;
    year?: number;
  }
) {
  try {
    const now = new Date();
    const year = financials.year || now.getFullYear();
    const month = financials.month || now.getMonth() + 1;

    // Check if financial record exists for this month/year
    const { data: existing } = await supabase
      .from('company_financials')
      .select('*')
      .eq('company_id', companyId)
      .eq('year', year)
      .eq('month', month)
      .maybeSingle();

    const data: any = {
      company_id: companyId,
      year,
      month,
      updated_at: new Date().toISOString(),
    };

    // Only update fields that were extracted
    if (financials.arr !== undefined) data.arr = financials.arr;
    if (financials.gross_retention !== undefined) data.gross_retention = financials.gross_retention;
    if (financials.net_retention !== undefined) data.net_retention = financials.net_retention;
    if (financials.gross_margin !== undefined) data.gross_margin = financials.gross_margin;
    if (financials.ebitda !== undefined) data.ebitda = financials.ebitda;

    if (existing) {
      // Update existing record
      await supabase
        .from('company_financials')
        .update(data)
        .eq('id', existing.id);
    } else {
      // Create new record
      await supabase
        .from('company_financials')
        .insert(data);
    }

    console.log('[VAPI Webhook] Updated financials for company:', companyId, data);
  } catch (error) {
    console.error('[VAPI Webhook] Error updating financials:', error);
    throw error;
  }
}

