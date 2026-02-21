import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkExecutionDetails() {
  const executionId = '0e6c9b66-81f4-4852-9fa4-c57ecb2f2bb6';
  
  const { data: execution } = await supabase
    .from('cadence_executions')
    .select('*')
    .eq('id', executionId)
    .single();

  if (!execution) {
    console.error('Execution not found');
    return;
  }

  console.log('Execution Details:');
  console.log('ID:', execution.id);
  console.log('Status:', execution.status);
  console.log('Current Block ID:', execution.current_block_id);
  console.log('Scheduled For:', execution.scheduled_for ? new Date(execution.scheduled_for).toLocaleString() : 'NULL');
  if (execution.scheduled_for) {
    const now = new Date();
    const scheduled = new Date(execution.scheduled_for);
    const diffMs = scheduled.getTime() - now.getTime();
    console.log('Time Until Scheduled:', Math.round(diffMs / 1000), 'seconds');
    console.log('Is Past Due:', diffMs < 0 ? 'YES' : 'NO');
  }
  console.log('Metadata:', JSON.stringify(execution.metadata, null, 2));
}

checkExecutionDetails();







