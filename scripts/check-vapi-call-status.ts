import { VapiClient } from '@vapi-ai/server-sdk';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

/**
 * Script to check the actual status of recent calls from VAPI
 * and compare with what's in the database
 */
async function checkVAPICallStatus() {
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

    // Get the most recent call log
    const { data: callLogs, error } = await supabase
      .from('call_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('Error fetching call logs:', error);
      return;
    }

    if (!callLogs || callLogs.length === 0) {
      console.log('No call logs found');
      return;
    }

    console.log(`\n📞 Checking status of ${callLogs.length} recent calls...\n`);

    for (const callLog of callLogs) {
      if (!callLog.vapi_call_id) {
        console.log(`\n⚠️  Call ${callLog.id} has no VAPI call ID`);
        continue;
      }

      console.log(`\n--- Checking Call: ${callLog.id} ---`);
      console.log(`VAPI Call ID: ${callLog.vapi_call_id}`);
      console.log(`DB Status: ${callLog.status || 'N/A'}`);
      console.log(`Created: ${new Date(callLog.created_at).toLocaleString()}`);

      try {
        // Fetch actual call status from VAPI
        const vapiCall = await vapi.calls.get(callLog.vapi_call_id);
        
        console.log(`\n✅ VAPI Call Status: ${vapiCall.status || 'N/A'}`);
        console.log(`   Ended At: ${vapiCall.endedAt ? new Date(vapiCall.endedAt).toLocaleString() : 'N/A'}`);
        console.log(`   Duration: ${vapiCall.duration ? `${vapiCall.duration}s` : 'N/A'}`);
        
        // Check for transcript
        const transcript = (vapiCall as any).transcript || (vapiCall as any).transcription;
        if (transcript) {
          console.log(`\n   ✅ Has Transcription: YES (${transcript.length} chars)`);
          console.log(`   Preview: ${transcript.substring(0, 100)}...`);
        } else {
          console.log(`\n   ❌ Has Transcription: NO`);
        }

        // Check for summary
        const summary = (vapiCall as any).summary;
        if (summary) {
          console.log(`\n   ✅ Has Summary: YES (${summary.length} chars)`);
          console.log(`   Preview: ${summary.substring(0, 100)}...`);
        } else {
          console.log(`\n   ❌ Has Summary: NO`);
        }

        // Check recording URL
        const recordingUrl = (vapiCall as any).recordingUrl || (vapiCall as any).recording_url;
        if (recordingUrl) {
          console.log(`\n   ✅ Has Recording: YES`);
          console.log(`   URL: ${recordingUrl}`);
        }

        // Compare with database
        if (vapiCall.status === 'ended' || vapiCall.status === 'completed') {
          if (!callLog.transcription && transcript) {
            console.log(`\n   ⚠️  MISMATCH: VAPI has transcript but DB does not!`);
            console.log(`   This suggests the webhook may not have fired or processed correctly.`);
          }
          if (!callLog.notes && summary) {
            console.log(`\n   ⚠️  MISMATCH: VAPI has summary but DB does not!`);
          }
          if (callLog.status !== vapiCall.status) {
            console.log(`\n   ⚠️  Status mismatch: DB=${callLog.status}, VAPI=${vapiCall.status}`);
          }
        }

        // Full VAPI call data for debugging
        console.log(`\n   📋 Full VAPI Call Data:`);
        console.log(`   ${JSON.stringify(vapiCall, null, 2).substring(0, 500)}...`);

      } catch (vapiError: any) {
        console.log(`\n   ❌ Error fetching from VAPI: ${vapiError.message}`);
        if (vapiError.statusCode === 404) {
          console.log(`   ⚠️  Call not found in VAPI - it may have been deleted or never completed`);
        }
      }
    }

    console.log(`\n\n💡 Recommendation:`);
    if (callLogs.some(c => c.status === 'queued' && !c.transcription)) {
      console.log(`   Some calls are still queued. Wait for them to complete.`);
      console.log(`   If calls have completed but still show "queued", check webhook configuration.`);
    }

  } catch (error: any) {
    console.error('Error:', error.message);
    console.error(error);
  }
}

// Run the script
checkVAPICallStatus().then(() => {
  console.log('\n✅ Check complete!');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});

