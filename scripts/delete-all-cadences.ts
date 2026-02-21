import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import * as path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function deleteAllCadences() {
  console.log('🗑️  Deleting all cadences...\n');

  // First, get all cadences
  const { data: cadences, error: fetchError } = await supabase
    .from('cadences')
    .select('id, name');

  if (fetchError) {
    console.error('❌ Error fetching cadences:', fetchError);
    return;
  }

  if (!cadences || cadences.length === 0) {
    console.log('✅ No cadences to delete');
    return;
  }

  console.log(`Found ${cadences.length} cadence(s) to delete:`);
  cadences.forEach(c => console.log(`  - ${c.name} (${c.id})`));
  console.log('');

  // Delete all cadences
  const { error: deleteError } = await supabase
    .from('cadences')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all (using a condition that matches everything)

  if (deleteError) {
    console.error('❌ Error deleting cadences:', deleteError);
    return;
  }

  console.log('✅ Successfully deleted all cadences!');
}

deleteAllCadences();







