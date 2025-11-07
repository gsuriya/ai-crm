import dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function listCompanies() {
  const { data, error } = await supabase
    .from('companies')
    .select('name, website, linkedin_url')
    .limit(20);

  if (error) {
    console.error('Error:', error);
    return;
  }

  if (!data || data.length === 0) {
    console.log('No companies found in database');
    return;
  }

  console.log(`\nFound ${data.length} companies:\n`);
  data.forEach((c, i) => {
    console.log(`${i + 1}. ${c.name}`);
    console.log(`   Website: ${c.website || 'N/A'}`);
    console.log(`   LinkedIn: ${c.linkedin_url || 'N/A'}`);
    console.log('');
  });
}

listCompanies().catch(console.error);

