import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

/**
 * Script to check recent call logs and verify if notes/transcriptions were logged
 */
async function checkRecentCalls() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Missing Supabase credentials');
      console.log('Need: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)');
      process.exit(1);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the most recent call logs (last 10)
    const { data: callLogs, error } = await supabase
      .from('call_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching call logs:', error);
      return;
    }

    if (!callLogs || callLogs.length === 0) {
      console.log('No call logs发现');
      return;
    }

    console.log(`\n📞 Found ${callLogs.length} recent call(s):\n`);

    callLogs.forEach((call, index) => {
      console.log(`--- Call #${index + 1} ---`);
      console.log(`ID: ${call.id}`);
      console.log(`Company ID: ${call.company_id}`);
      console.log(`Call Type: ${call.call_type}`);
      console.log(`Direction: ${call.direction}`);
      console.log(`Phone Number: ${call.phone_number || 'N/A'}`);
      console.log(`VAPI Call ID: ${call.vapi_call_id || 'N/A'}`);
      console.log(`Status: ${call.status || 'N/A'}`);
      console.log(`Duration: ${call.duration_seconds ? `${call.duration_seconds}s` : 'N/A'}`);
      console.log(`Created At: ${new Date(call.created_at).toLocaleString()}`);
      
      // Check if transcription exists
      const hasTranscription = !!call.transcription;
      const transcriptionLength = call.transcription?.length || 0;
      console.log(`\n📝 Transcription:`);
      console.log(`   Has Transcription: ${hasTranscription ? '✅ YES' : '❌ NO'}`);
      if (hasTranscription) {
        console.log(`   Length: ${transcriptionLength} characters`);
        console.log(`   Preview: ${call.transcription.substring(0, 150)}${transcriptionLength > 150 ? '...' : ''}`);
      }
      
      // Check if notes exist
      const hasNotes = !!call.notes;
      const notesLength = call.notes?.length || 0;
      console.log(`\n📋 Notes:`);
      console.log(`   Has Notes: ${hasNotes ? '✅ YES' : '✅ NO'}`);
      if (hasNotes) {
        console.log(`   Length: ${notesLength} characters`);
        console.log(`   Preview: ${call.notes.substring(0, 150)}${notesLength > 150 ? '...' : ''}`);
      }

      // Check metadata
      if (call.metadata && Object.keys(call.metadata).length > 0) {
        console.log(`\n🔍 Metadata:`);
        console.log(`   ${JSON.stringify(call.metadata, null, 2)}`);
      }

      // Summary
      console.log(`\n✅ Call Logged: YES`);
      console.log(`✅ Transcription Logged: ${hasTranscription ? 'YES' : 'NO'}`);
      console.log(`✅ Notes Logged: ${hasNotes ? 'YES' : 'NO'}`);
      
      console.log('\n');
    });

    // Get the most recent call
    const mostRecentCall = callLogs[0];
    console.log('\n' + '='.repeat(50));
    console.log('📊 MOST RECENT CALL SUMMARY');
    console.log('='.repeat(50));
    console.log(`Time: ${new Date(mostRecentCall.created_at).toLocaleString()}`);
    console.log(`Type: ${mostRecentCall.call_type}`);
    console.log(`Status: ${mostRecentCall.status || 'N/A'}`);
    console.log(`Has Transcription: ${mostRecentCall.transcription ? '✅ YES' : '❌ NO'}`);
    console.log(`Has Notes: ${mostRecentCall.notes ? '✅ YES' : '❌ NO'}`);
    
    if (mostRecentCall.transcription) {
      console.log(`\n📝 Full Transcription:\n${mostRecentCall.transcription}\n`);
    }
    
    if (mostRecentCall.notes) {
      console.log(`\n📋 Full Notes:\n${mostRecentCall.notes}\n`);
    }

  } catch (error: any) {
    console.error('Error:', error.message);
    console.error(error);
  }
}

// Run the script
checkRecentCalls().then(() => {
  console.log('\n✅ Check complete!');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});

