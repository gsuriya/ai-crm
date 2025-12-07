import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import * as path from 'path';
import { getExecution, executeNextBlock } from '../lib/services/cadence-execution';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testCadenceExecution() {
  console.log('🧪 Testing Cadence Execution\n');
  console.log('Contact: Suriya (sg.suriya.v@gmail.com)');
  console.log('Company: NYU Stern');
  console.log('Cadence: IB Reachout\n');

  try {
    // Step 1: Find or create company
    console.log('📦 Step 1: Finding/creating company...');
    let company: any = null;
    
    const { data: existingCompany } = await supabase
      .from('companies')
      .select('*')
      .eq('name', 'NYU Stern')
      .single();

    if (existingCompany) {
      company = existingCompany;
      console.log(`   ✅ Found company: ${company.name} (${company.id})`);
    } else {
      const { data: newCompany, error: companyError } = await supabase
        .from('companies')
        .insert({ name: 'NYU Stern' })
        .select()
        .single();

      if (companyError) {
        throw new Error(`Failed to create company: ${companyError.message}`);
      }
      company = newCompany;
      console.log(`   ✅ Created company: ${company.name} (${company.id})`);
    }

    // Step 2: Find or create contact
    console.log('\n👤 Step 2: Finding/creating contact...');
    let contact: any = null;

    const { data: existingContact } = await supabase
      .from('contacts')
      .select('*')
      .eq('email', 'sg.suriya.v@gmail.com')
      .single();

    if (existingContact) {
      contact = existingContact;
      console.log(`   ✅ Found contact: ${contact.first_name} ${contact.last_name} (${contact.email})`);
    } else {
      const { data: newContact, error: contactError } = await supabase
        .from('contacts')
        .insert({
          first_name: 'Suriya',
          last_name: 'V',
          email: 'sg.suriya.v@gmail.com',
          current_company: 'NYU Stern',
        })
        .select()
        .single();

      if (contactError) {
        throw new Error(`Failed to create contact: ${contactError.message}`);
      }
      contact = newContact;
      console.log(`   ✅ Created contact: ${contact.first_name} ${contact.last_name} (${contact.email})`);
    }

    // Step 3: Find IB Reachout cadence
    console.log('\n📋 Step 3: Finding IB Reachout cadence...');
    const { data: cadence, error: cadenceError } = await supabase
      .from('cadences')
      .select('*')
      .eq('name', 'IB Reachout')
      .single();

    if (cadenceError || !cadence) {
      throw new Error(`Cadence "IB Reachout" not found: ${cadenceError?.message}`);
    }

    console.log(`   ✅ Found cadence: ${cadence.name} (${cadence.id})`);
    const blocks = cadence.nodes || [];
    console.log(`   📦 Cadence has ${blocks.length} blocks:`);
    blocks.forEach((block: any, index: number) => {
      console.log(`      ${index + 1}. ${block.type}: ${block.title || block.id}`);
      if (block.type === 'delay' && block.config) {
        console.log(`         Delay: ${block.config.delayDays || 0}d ${block.config.delayHours || 0}h ${block.config.delayMinutes || 0}m`);
      }
    });

    // Step 4: Find or create company_cadence
    console.log('\n🔗 Step 4: Finding/creating company_cadence...');
    let companyCadence: any = null;

    const { data: existingCC } = await supabase
      .from('company_cadences')
      .select('*')
      .eq('company_id', company.id)
      .eq('cadence_id', cadence.id)
      .single();

    if (existingCC) {
      companyCadence = existingCC;
      console.log(`   ✅ Found existing company_cadence: ${companyCadence.id}`);
      console.log(`   Status: ${companyCadence.status}`);
      
      // If it's completed, we'll restart it
      if (companyCadence.status === 'completed') {
        console.log('   🔄 Resetting to active...');
        await supabase
          .from('company_cadences')
          .update({ status: 'active', completed_at: null })
          .eq('id', companyCadence.id);
        companyCadence.status = 'active';
      }
    } else {
      const { data: newCC, error: ccError } = await supabase
        .from('company_cadences')
        .insert({
          company_id: company.id,
          contact_id: contact.id,
          cadence_id: cadence.id,
          status: 'active',
        })
        .select()
        .single();

      if (ccError) {
        throw new Error(`Failed to create company_cadence: ${ccError.message}`);
      }
      companyCadence = newCC;
      console.log(`   ✅ Created company_cadence: ${companyCadence.id}`);
    }

    // Step 5: Delete any existing executions (start fresh)
    console.log('\n🗑️  Step 5: Cleaning up old executions...');
    const { error: deleteError } = await supabase
      .from('cadence_executions')
      .delete()
      .eq('company_cadence_id', companyCadence.id);

    if (deleteError) {
      console.log(`   ⚠️  Warning: Could not delete old executions: ${deleteError.message}`);
    } else {
      console.log('   ✅ Cleaned up old executions');
    }

    // Step 6: Start workflow execution
    console.log('\n🚀 Step 6: Starting workflow execution...');
    
    // We need to authenticate as a user to use startWorkflowExecution
    // For testing, let's create the execution manually
    const triggerBlock = blocks.find((b: any) => b.type === 'trigger');
    if (!triggerBlock) {
      throw new Error('No trigger block found in cadence');
    }

    const { data: execution, error: execError } = await supabase
      .from('cadence_executions')
      .insert({
        company_cadence_id: companyCadence.id,
        current_block_id: triggerBlock.id,
        status: 'active',
        metadata: {
          company_id: company.id,
          cadence_id: cadence.id,
          contact_id: contact.id,
          blocks: blocks,
          executedBlockIds: [],
        },
      })
      .select()
      .single();

    if (execError) {
      throw new Error(`Failed to create execution: ${execError.message}`);
    }

    console.log(`   ✅ Created execution: ${execution.id}`);
    console.log(`   Current block: ${execution.current_block_id} (trigger)`);

    // Step 7: Get a user_id for the execution (needed for sending emails)
    console.log('\n👤 Step 7: Getting user session...');
    const { data: session } = await supabase
      .from('user_sessions')
      .select('user_id')
      .limit(1)
      .single();

    if (!session) {
      throw new Error('No user session found. Please sign in to your CRM first.');
    }

    console.log(`   ✅ Using user_id: ${session.user_id}`);

    // Update execution metadata with user_id
    await supabase
      .from('cadence_executions')
      .update({
        metadata: {
          ...execution.metadata,
          user_id: session.user_id,
        },
      })
      .eq('id', execution.id);

    // Step 8: Execute the cadence (process first block after trigger)
    console.log('\n⚡ Step 8: Executing cadence...');
    console.log('   This will send the first email and process wait blocks...\n');

    // Get the execution with updated metadata
    const fullExecution = await getExecution(supabase, execution.id);
    if (!fullExecution) {
      throw new Error('Failed to fetch execution');
    }

    // Execute the workflow - this will process the trigger and move to first block
    try {
      await executeNextBlock(supabase, fullExecution, blocks, { skipRecursion: false });
      console.log('   ✅ Execution started successfully');
    } catch (execError: any) {
      console.error(`   ⚠️  Execution error: ${execError.message}`);
      throw execError;
    }

    // Wait a moment for execution to complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check execution status
    const updatedExecution = await getExecution(supabase, execution.id);
    if (updatedExecution) {
      console.log('\n📊 Execution Status:');
      console.log(`   Status: ${updatedExecution.status}`);
      console.log(`   Current Block ID: ${updatedExecution.current_block_id}`);
      
      const currentBlock = blocks.find((b: any) => b.id === updatedExecution.current_block_id);
      if (currentBlock) {
        console.log(`   Current Block: ${currentBlock.type} - ${currentBlock.title || currentBlock.id}`);
      }
      
      if (updatedExecution.scheduled_for) {
        console.log(`   ⏰ Scheduled For: ${new Date(updatedExecution.scheduled_for).toLocaleString()}`);
        console.log(`   ⏰ Next execution will happen at: ${new Date(updatedExecution.scheduled_for).toLocaleString()}`);
      } else {
        console.log(`   ✅ Execution completed or ready for next step`);
      }
      
      const executedBlockIds = updatedExecution.metadata?.executedBlockIds || [];
      console.log(`   📝 Executed blocks: ${executedBlockIds.length}`);
      executedBlockIds.forEach((blockId: string, index: number) => {
        const block = blocks.find((b: any) => b.id === blockId);
        console.log(`      ${index + 1}. ${block?.type || 'unknown'}: ${block?.title || blockId}`);
      });
    }

    console.log('\n✅ Test completed!');
    console.log('\n💡 Check your Gmail (sg.suriya.v@gmail.com) for the first email!');
    console.log('\n💡 To process scheduled executions manually, call:');
    console.log('   POST http://localhost:3000/api/cadence/process');
    console.log('\n💡 Or wait for the background processor to pick it up automatically.');

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

testCadenceExecution();
