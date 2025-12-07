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

async function checkCadenceExecution() {
  console.log('🔍 Checking cadence execution status...\n');

  // Get IB Reachout cadence
  const { data: cadence } = await supabase
    .from('cadences')
    .select('*')
    .eq('name', 'IB Reachout')
    .single();

  if (!cadence) {
    console.error('❌ Cadence not found');
    return;
  }

  console.log(`📋 Cadence: ${cadence.name}`);
  console.log(`   ID: ${cadence.id}\n`);

  const blocks = cadence.nodes || [];
  console.log(`📦 Blocks (${blocks.length}):`);
  blocks.forEach((block: any, index: number) => {
    console.log(`   ${index + 1}. ${block.type}: ${block.title || block.id}`);
    if (block.connections) {
      console.log(`      → Connects to: ${block.connections.join(', ')}`);
    }
    if (block.type === 'delay' && block.config) {
      console.log(`      Delay: ${block.config.delayDays || 0}d ${block.config.delayHours || 0}h ${block.config.delayMinutes || 0}m ${block.config.delaySeconds || 0}s`);
    }
    if (block.type === 'email' && block.config) {
      console.log(`      Subject: ${block.config.subject || '(empty)'}`);
    }
  });

  // Get executions for this cadence
  console.log('\n⚡ Executions:');
  const { data: companyCadences } = await supabase
    .from('company_cadences')
    .select('id')
    .eq('cadence_id', cadence.id);

  if (companyCadences && companyCadences.length > 0) {
    const ccIds = companyCadences.map(cc => cc.id);
    const { data: executions } = await supabase
      .from('cadence_executions')
      .select('*')
      .in('company_cadence_id', ccIds)
      .order('created_at', { ascending: false });

    if (executions && executions.length > 0) {
      executions.forEach((exec, index) => {
        console.log(`\n   Execution ${index + 1}:`);
        console.log(`   ID: ${exec.id}`);
        console.log(`   Status: ${exec.status}`);
        console.log(`   Current Block ID: ${exec.current_block_id}`);
        const currentBlock = blocks.find((b: any) => b.id === exec.current_block_id);
        console.log(`   Current Block: ${currentBlock ? `${currentBlock.type} - ${currentBlock.title || currentBlock.id}` : 'NOT FOUND'}`);
        if (exec.scheduled_for) {
          console.log(`   Scheduled For: ${new Date(exec.scheduled_for).toLocaleString()}`);
          const now = new Date();
          const scheduled = new Date(exec.scheduled_for);
          if (scheduled <= now) {
            console.log(`   ⚠️  SCHEDULED TIME HAS PASSED - Should be processed!`);
          } else {
            console.log(`   ⏰ Will execute in ${Math.round((scheduled.getTime() - now.getTime()) / 1000)} seconds`);
          }
        }
        const executedBlockIds = exec.metadata?.executedBlockIds || [];
        console.log(`   Executed Blocks: ${executedBlockIds.length}`);
        executedBlockIds.forEach((blockId: string, idx: number) => {
          const block = blocks.find((b: any) => b.id === blockId);
          console.log(`      ${idx + 1}. ${block ? `${block.type} - ${block.title || blockId}` : blockId}`);
        });
        const threadInfoMap = exec.metadata?.threadInfoMap || {};
        console.log(`   Thread Info: ${Object.keys(threadInfoMap).length} thread(s)`);
        Object.entries(threadInfoMap).forEach(([blockId, info]: [string, any]) => {
          const block = blocks.find((b: any) => b.id === blockId);
          console.log(`      ${block ? `${block.type} - ${block.title || blockId}` : blockId}: Thread ${info.threadId}`);
        });
      });
    } else {
      console.log('   No executions found');
    }
  } else {
    console.log('   No company_cadences found');
  }
}

checkCadenceExecution();
