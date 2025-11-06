import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function backfillCallNotes() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  console.log('\n📋 Backfilling Call Notes to company_content\n');

  // Get all calls with notes
  const { data: callLogs, error } = await supabase
    .from('call_logs')
    .select('*')
    .not('notes', 'is', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching calls:', error);
    return;
  }

  if (!callLogs || callLogs.length === 0) {
    console.log('No calls with notes found');
    return;
  }

  console.log(`Found ${callLogs.length} calls with notes\n`);

  let success = 0;
  let skipped = 0;
  let errors = 0;

  for (const call of callLogs) {
    // Check if note already exists in company_content
    const { data: existing } = await supabase
      .from('company_content')
      .select('id')
      .eq('company_id', call.company_id)
      .eq('content_type', 'note')
      .eq('source', 'vapi_call')
      .contains('metadata', { call_log_id: call.id })
      .limit(1);

    if (existing && existing.length > 0) {
      console.log(`⏭️  Skipping call ${call.id} - note already exists in company_content`);
      skipped++;
      continue;
    }

    try {
      const { error: insertError } = await supabase
        .from('company_content')
        .insert({
          company_id: call.company_id,
          content_type: 'note',
          content: call.notes,
          source: 'vapi_call',
          metadata: {
            call_log_id: call.id,
            vapi_call_id: call.vapi_call_id,
            call_type: call.call_type,
            phone_number: call.phone_number,
            created_at: call.created_at,
          },
        });

      if (insertError) {
        console.log(`❌ Error for call ${call.id}: ${insertError.message}`);
        errors++;
      } else {
        console.log(`✅ Backfilled note for call ${call.id}`);
        success++;
      }
    } catch (err: any) {
      console.log(`❌ Error for call ${call.id}: ${err.message}`);
      errors++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Successfully backfilled: ${success}`);
  console.log(`   ⏭️  Skipped (already exists): ${skipped}`);
  console.log(`   ❌ Errors: ${errors}`);
}

backfillCallNotes().catch(console.error);

