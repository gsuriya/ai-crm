import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function deleteAllCompanies() {
  console.log('🗑️  Deleting all companies...');
  
  // First, get count
  const { data: companies, error: fetchError } = await supabase
    .from('companies')
    .select('id, name');
  
  if (fetchError) {
    console.error('Error fetching companies:', fetchError);
    return;
  }
  
  console.log(`Found ${companies?.length || 0} companies to delete`);
  
  if (companies && companies.length > 0) {
    // Show what we're deleting
    companies.forEach((company, i) => {
      console.log(`  ${i + 1}. ${company.name}`);
    });
    
    // Delete all
    const { error: deleteError } = await supabase
      .from('companies')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Matches all records
    
    if (deleteError) {
      console.error('❌ Error deleting companies:', deleteError);
    } else {
      console.log(`✅ Successfully deleted all ${companies.length} companies!`);
      console.log('Your Companies list is now empty and ready.');
    }
  } else {
    console.log('No companies to delete - database is already empty!');
  }
}

deleteAllCompanies().catch(console.error);


