import { VapiClient } from '@vapi-ai/server-sdk';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

/**
 * Script to manually sync call data from VAPI to database
 * This fixes calls that completed but didn't receive webhook updates
 */
async function syncCallData() {
  try {
    const privateKey = process.env.VAPI_PRIVATE_KEY || process.env.VAPI_API_KEY;
    if (!privateKey) {
      console.error('❌ VAPI_PRIVATE_KEY or VAPI_API_KEY is not set');
      process.exit(1);
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Missing Supabase credentials');
      process.exit(1);
    }

    const vapi = new VapiClient({ token: privateKey });
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get calls that need syncing (status is queued or null, but have vapi_call_id)
    const { data: callLogs, error } = await supabase
      .from('call_logs')
      .select('*')
      .or('status.is.null,status.eq.queued')
      .not('vapi_call_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching call logs:', error);
      return;
    }

    if (!callLogs || callLogs.length === 0) {
      console.log('✅ No calls need syncing');
      return;
    }

    console.log(`\n📞 Found ${callLogs.length} calls to sync...\n`);

    let synced = 0;
    let skipped = 0;
    let errors = 0;

    for (const callLog of callLogs) {
      if (!callLog.vapi_call_id) {
        console.log(`⚠️  Skipping ${callLog.id} - no VAPI call ID`);
        skipped++;
        continue;
      }

      try {
        console.log(`\n🔄 Syncing call ${callLog.id}...`);
        console.log(`   VAPI Call ID: ${callLog.vapi_call_id}`);

        // Fetch actual call status from VAPI
        const vapiCall = await vapi.calls.get(callLog.vapi_call_id);
        
        const status = vapiCall.status || 'unknown';
        const transcript = (vapiCall as any).transcript || (vapiCall as any).transcription;
        const summary = (vapiCall as any).summary;
        const recordingUrl = (vapiCall as any).recordingUrl || (vapiCall as any).recording_url;
        const duration = (vapiCall as any).duration;
        const endedAt = (vapiCall as any).endedAt;

        console.log(`   Status: ${status}`);
        console.log(`   Has Transcript: ${transcript ? 'YES' : 'NO'}`);
        console.log(`   Has Summary: ${summary ? 'YES' : 'NO'}`);

        // Only update if call has ended and has data
        if (status === 'ended' || status === 'completed' || transcript) {
          const updates: any = {
            status: status,
          };

          if (transcript) {
            updates.transcription = transcript;
          }

          if (summary) {
            updates.notes = summary;
          } else if (transcript) {
            // Generate summary if not provided
            console.log(`   Generating summary...`);
            try {
              const { generateCallSummary } = await import('@/lib/services/call-processing');
              const generatedSummary = await generateCallSummary(transcript, callLog.company_id);
              updates.notes = generatedSummary;
              console.log(`   ✅ Summary generated`);
            } catch (summaryError) {
              console.log(`   ⚠️  Could not generate summary: ${summaryError}`);
            }
          }

          if (duration) {
            updates.duration_seconds = duration;
          }

          // Update metadata
          const metadata = callLog.metadata || {};
          if (recordingUrl) {
            metadata.recording_url = recordingUrl;
          }
          if (endedAt) {
            metadata.ended_at = endedAt;
          }
          metadata.synced_at = new Date().toISOString();
          metadata.sync_method = 'manual_script';
          updates.metadata = metadata;

          // Update the database
          const { error: updateError } = await supabase
            .from('call_logs')
            .update(updates)
            .eq('id', callLog.id);

          if (updateError) {
            console.log(`   ❌ Update failed: ${updateError.message}`);
            errors++;
          } else {
            console.log(`   ✅ Successfully synced!`);
            synced++;
          }
        } else {
          console.log(`   ⏸️  Call still in progress (status: ${status}), skipping`);
          skipped++;
        }

      } catch (vapiError: any) {
        console.log(`   ❌ Error fetching from VAPI: ${vapiError.message}`);
        if (vapiError.statusCode === 404) {
          console.log(`   ⚠️  Call not found in VAPI - may have been deleted`);
        }
        errors++;
      }
    }

    console.log(`\n\n📊 Sync Summary:`);
    console.log(`   ✅ Synced: ${synced}`);
    console.log(`   ⏸️  Skipped: ${skipped}`);
    console.log(`   ❌ Errors: ${errors}`);

    if (synced > 0) {
      console.log(`\n🎉 Successfully synced ${synced} call(s)!`);
    }

  } catch (error: any) {
    console.error('Error:', error.message);
    console.error(error);
  }
}

// Run the script
syncCallData().then(() => {
  console.log('\n✅ Sync complete!');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});

