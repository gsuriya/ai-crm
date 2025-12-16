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

async function resetExecution() {
  const executionId = '0e6c9b66-81f4-4852-9fa4-c57ecb2f2bb6';
  
  // Reset status to active and clear error
  const { error } = await supabase
    .from('cadence_executions')
    .update({
      status: 'active',
      metadata: (await supabase.from('cadence_executions').select('metadata').eq('id', executionId).single()).data?.metadata || {}
    })
    .eq('id', executionId);
  
  if (error) {
    console.error('Error resetting execution:', error);
    return;
  }
  
  // Remove error from metadata
  const execution = await getExecution(supabase, executionId);
  if (execution) {
    const metadata = { ...execution.metadata };
    delete metadata.error;
    
    await supabase
      .from('cadence_executions')
      .update({ metadata })
      .eq('id', executionId);
  }
  
  console.log('✅ Execution reset to active');
  
  // Now execute the block
  const updatedExecution = await getExecution(supabase, executionId);
  if (!updatedExecution) {
    console.error('Execution not found');
    return;
  }
  
  const metadata = updatedExecution.metadata || {};
  const cadenceId = metadata.cadence_id;
  
  const { data: cadence } = await supabase
    .from('cadences')
    .select('nodes')
    .eq('id', cadenceId)
    .single();
  
  if (!cadence || !cadence.nodes) {
    console.error('Cadence not found');
    return;
  }
  
  const blocks = cadence.nodes as FlowBlock[];
  console.log('⚡ Executing email block...');
  await executeNextBlock(supabase, updatedExecution, blocks, { skipRecursion: false });
  console.log('✅ Done!');
}

resetExecution();


