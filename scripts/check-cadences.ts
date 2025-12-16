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

async function checkCadences() {
  console.log('🔍 Checking cadences in database...\n');

  // Get all cadences
  const { data: cadences, error } = await supabase
    .from('cadences')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error fetching cadences:', error);
    return;
  }

  if (!cadences || cadences.length === 0) {
    console.log('✅ No cadences found in database (clean!)');
    return;
  }

  console.log(`Found ${cadences.length} cadence(s):\n`);
  
  cadences.forEach((cadence, index) => {
    console.log(`${index + 1}. Cadence:`);
    console.log(`   ID: ${cadence.id}`);
    console.log(`   Name: ${cadence.name}`);
    console.log(`   Description: ${cadence.description || 'N/A'}`);
    console.log(`   Active: ${cadence.is_active}`);
    console.log(`   Created: ${cadence.created_at}`);
    console.log('');
  });
}

checkCadences();


