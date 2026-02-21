import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import * as path from 'path';
import { getExecution, executeNextBlock } from '@/lib/services/cadence-execution';
import { FlowBlock } from '@/components/cadence-flow-builder';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function manuallyExecuteBlock() {
  const executionId = '0e6c9b66-81f4-4852-9fa4-c57ecb2f2bb6';
  
  console.log('🔍 Fetching execution...');
  const execution = await getExecution(supabase, executionId);
  
  if (!execution) {
    console.error('❌ Execution not found');
    return;
  }
  
  console.log('📋 Execution:', {
    id: execution.id,
    status: execution.status,
    current_block_id: execution.current_block_id,
    scheduled_for: execution.scheduled_for,
  });
  
  // Get cadence blocks
  const metadata = execution.metadata || {};
  const cadenceId = metadata.cadence_id;
  
  const { data: cadence } = await supabase
    .from('cadences')
    .select('nodes')
    .eq('id', cadenceId)
    .single();
  
  if (!cadence || !cadence.nodes) {
    console.error('❌ Cadence not found');
    return;
  }
  
  const blocks = cadence.nodes as FlowBlock[];
  const currentBlock = blocks.find(b => b.id === execution.current_block_id);
  
  console.log('📦 Current block:', currentBlock ? `${currentBlock.type} - ${currentBlock.title || currentBlock.id}` : 'NOT FOUND');
  
  console.log('⚡ Executing next block...');
  await executeNextBlock(supabase, execution, blocks, { skipRecursion: false });
  
  console.log('✅ Execution complete!');
  
  // Check updated execution
  const updatedExecution = await getExecution(supabase, executionId);
  if (updatedExecution) {
    console.log('📋 Updated execution:', {
      current_block_id: updatedExecution.current_block_id,
      scheduled_for: updatedExecution.scheduled_for ? new Date(updatedExecution.scheduled_for).toLocaleString() : 'NULL',
      status: updatedExecution.status,
    });
  }
}

manuallyExecuteBlock();







