import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUserSessions() {
  console.log('🔍 Checking user_sessions table...\n');

  const { data: sessions, error } = await supabase
    .from('user_sessions')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  if (!sessions || sessions.length === 0) {
    console.log('⚠️  No user sessions found!');
    console.log('   → Please sign in to your CRM at http://localhost:3000');
    return;
  }

  console.log(`Found ${sessions.length} session(s):\n`);

  sessions.forEach((session, index) => {
    console.log(`${index + 1}. User ID: ${session.user_id}`);
    console.log(`   Has refresh_token: ${!!session.refresh_token}`);
    console.log(`   Has access_token: ${!!session.access_token}`);
    console.log(`   Token expires: ${session.token_expires_at || 'N/A'}`);
    console.log(`   Updated: ${session.updated_at || 'N/A'}`);
    console.log('');
  });

  console.log('💡 If tokens are missing or expired, sign out and sign back in.');
}

checkUserSessions();







