import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function getRecentCallCompany() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: callLogs } = await supabase
    .from('call_logs')
    .select('*, companies(id, name)')
    .order('created_at', { ascending: false })
    .limit(1);

  if (callLogs && callLogs.length > 0) {
    const call = callLogs[0];
    const company = call.companies as any;
    
    console.log('\n📞 Most Recent Call:');
    console.log('Company ID:', company?.id);
    console.log('Company Name:', company?.name);
    console.log('');
    console.log('🌐 Frontend URL:');
    console.log(`http://localhost:3000/companies/${company?.id}`);
    console.log('');
    console.log('Call Details:');
    console.log('Status:', call.status);
    console.log('Has Transcription:', !!call.transcription ? '✅ YES' : '❌ NO');
    console.log('Has Notes:', !!call.notes ? '✅ YES' : '❌ NO');
    console.log('Created:', new Date(call.created_at).toLocaleString());
    console.log('');
  }
}

getRecentCallCompany().catch(console.error);

