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

async function deleteAllContacts() {
  console.log('🗑️  Deleting all contacts...');
  
  // First, get count
  const { data: contacts, error: fetchError } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, email');
  
  if (fetchError) {
    console.error('Error fetching contacts:', fetchError);
    return;
  }
  
  console.log(`Found ${contacts?.length || 0} contacts to delete`);
  
  if (contacts && contacts.length > 0) {
    // Show what we're deleting
    contacts.forEach((contact, i) => {
      console.log(`  ${i + 1}. ${contact.first_name} ${contact.last_name} (${contact.email || 'no email'})`);
    });
    
    // Delete all
    const { error: deleteError } = await supabase
      .from('contacts')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Matches all records
    
    if (deleteError) {
      console.error('❌ Error deleting contacts:', deleteError);
    } else {
      console.log(`✅ Successfully deleted all ${contacts.length} contacts!`);
      console.log('Your People CRM is now empty and ready for real contacts.');
    }
  } else {
    console.log('No contacts to delete - database is already empty!');
  }
}

deleteAllContacts().catch(console.error);
