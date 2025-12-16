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

async function deleteOldSessions() {
  console.log('🗑️  Deleting all user sessions...\n');

  const { error } = await supabase
    .from('user_sessions')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log('✅ All user sessions deleted!');
  console.log('\n💡 Now sign out and sign back in at http://localhost:3000');
  console.log('   This will create a fresh session with valid tokens.');
}

deleteOldSessions();


