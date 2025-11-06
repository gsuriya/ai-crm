import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function testCallNotesLocation() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  console.log('\n📋 Testing Call Notes Storage Location\n');
  console.log('='.repeat(60));

  // Get most recent call
  const { data: callLogs, error: callError } = await supabase
    .from('call_logs')
    .select('*, companies(name)')
    .order('created_at', { ascending: false })
    .limit(1);

  if (callError) {
    console.error('Error fetching calls:', callError);
    return;
  }

  if (!callLogs || callLogs.length === 0) {
    console.log('❌ No calls found');
    return;
  }

  const call = callLogs[0];
  console.log('\n📞 Most Recent Call:');
  console.log(`   ID: ${call.id}`);
  console.log(`   Company: ${(call.companies as any)?.name || 'N/A'}`);
  console.log(`   Company ID: ${call.company_id}`);
  console.log(`   Status: ${call.status}`);
  console.log(`   Created: ${new Date(call.created_at).toLocaleString()}`);
  
  console.log('\n📝 Transcription:');
  console.log(`   Has Transcription: ${call.transcription ? '✅ YES' : '❌ NO'}`);
  if (call.transcription) {
    console.log(`   Length: ${call.transcription.length} characters`);
    console.log(`   Preview: ${call.transcription.substring(0, 150)}...`);
  }

  console.log('\n📋 Notes:');
  console.log(`   Has Notes: ${call.notes ? '✅ YES' : '❌ NO'}`);
  if (call.notes) {
    console.log(`   Length: ${call.notes.length} characters`);
    console.log(`   Preview: ${call.notes.substring(0, 200)}...`);
    console.log(`   Full Notes:`);
    console.log(`   ${call.notes}`);
  }

  // Check if notes are in company_content table
  console.log('\n\n🔍 Checking company_content table:');
  const { data: content, error: contentError } = await supabase
    .from('company_content')
    .select('*')
    .eq('company_id', call.company_id)
    .eq('content_type', 'note')
    .order('created_at', { ascending: false })
    .limit(5);

  if (contentError) {
    console.error('Error fetching company_content:', contentError);
  } else {
    console.log(`   Found ${content?.length || 0} notes in company_content`);
    if (content && content.length > 0) {
      console.log('\n   Recent notes in company_content:');
      content.forEach((note, idx) => {
        console.log(`   ${idx + 1}. Created: ${new Date(note.created_at).toLocaleString()}`);
        console.log(`      Preview: ${note.content.substring(0, 100)}...`);
        console.log(`      Source: ${note.source || 'N/A'}`);
      });
    }
  }

  // Check if call notes are also saved to company_content
  console.log('\n\n✅ Summary:');
  console.log(`   Notes in call_logs: ${call.notes ? '✅ YES' : '❌ NO'}`);
  console.log(`   Notes in company_content: ${content && content.length > 0 ? '✅ YES' : '❌ NO'}`);
  
  if (call.notes && (!content || content.length === 0)) {
    console.log('\n   ⚠️  NOTE: Call notes are stored in call_logs but NOT in company_content');
    console.log('   The webhook should also save notes to company_content table.');
  } else if (call.notes && content && content.length > 0) {
    console.log('\n   ✅ Notes are stored in both locations');
  }

  console.log('\n' + '='.repeat(60));
}

testCallNotesLocation().catch(console.error);

