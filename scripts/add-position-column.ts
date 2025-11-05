import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables from .env.local
const envPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf-8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=:#]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

async function main() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('❌ Missing Supabase credentials');
      console.log('Need: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
      process.exit(1);
    }

    // Read migration SQL
    const migrationPath = path.join(__dirname, '../lib/db/migrations/add_position_to_contacts.sql');
    const sql = fs.readFileSync(migrationPath, 'utf-8').trim();

    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📝 Migration: Add position column to contacts table');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('⚠️  Supabase requires running DDL migrations manually in the SQL Editor.');
    console.log('');
    console.log('📋 To run this migration:');
    console.log('');
    console.log('1. Go to: https://supabase.com/dashboard');
    console.log('2. Select your project');
    console.log('3. Navigate to: SQL Editor (in the left sidebar)');
    console.log('4. Click "New query"');
    console.log('5. Copy and paste this SQL:');
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(sql);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('6. Click "Run" (or press Cmd/Ctrl + Enter)');
    console.log('7. Wait for success message');
    console.log('8. Refresh your app and try adding a contact again');
    console.log('');
    console.log('💡 Tip: After running the migration, Supabase will automatically refresh');
    console.log('   the schema cache within a few seconds.');
    console.log('');
    
    // Verify if column already exists
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    try {
      // Try to query the position column - if it exists, this will work
      const { error } = await supabase
        .from('contacts')
        .select('position')
        .limit(1);
      
      if (!error) {
        console.log('✅ The position column already exists! You can skip the migration.');
        console.log('');
        return;
      }
    } catch (e) {
      // Column doesn't exist, which is expected
    }
    
    console.log('❌ The position column does not exist yet. Please run the migration above.');
    console.log('');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.log('');
    console.log('Please run the SQL manually in Supabase SQL Editor.');
    process.exit(1);
  }
}

main();

