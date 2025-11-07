import dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function deleteFakeCompanies() {
  console.log('Fetching all companies...\n');
  
  // First, get all companies
  const { data: companies, error: fetchError } = await supabase
    .from('companies')
    .select('id, name');

  if (fetchError) {
    console.error('Error fetching companies:', fetchError);
    return;
  }

  if (!companies || companies.length === 0) {
    console.log('No companies found in database');
    return;
  }

  console.log(`Found ${companies.length} companies total\n`);

  // Filter out OpenRouter (case-insensitive)
  const companiesToDelete = companies.filter(
    company => company.name.toLowerCase() !== 'openrouter'
  );

  const openRouterCompany = companies.find(
    company => company.name.toLowerCase() === 'openrouter'
  );

  if (openRouterCompany) {
    console.log(`Keeping: ${openRouterCompany.name} (ID: ${openRouterCompany.id})\n`);
  }

  console.log(`Companies to delete: ${companiesToDelete.length}\n`);

  if (companiesToDelete.length === 0) {
    console.log('No companies to delete. Only OpenRouter exists.');
    return;
  }

  // Show what will be deleted
  console.log('Companies that will be deleted:');
  companiesToDelete.forEach((c, i) => {
    console.log(`  ${i + 1}. ${c.name} (ID: ${c.id})`);
  });

  console.log('\n⚠️  WARNING: This will delete all companies except OpenRouter!');
  console.log('This action cannot be undone.\n');

  // Delete companies one by one (or in batch)
  let deletedCount = 0;
  let errorCount = 0;

  for (const company of companiesToDelete) {
    const { error } = await supabase
      .from('companies')
      .delete()
      .eq('id', company.id);

    if (error) {
      console.error(`Error deleting ${company.name}:`, error);
      errorCount++;
    } else {
      console.log(`✓ Deleted: ${company.name}`);
      deletedCount++;
    }
  }

  console.log(`\n✅ Deletion complete!`);
  console.log(`   Deleted: ${deletedCount} companies`);
  if (errorCount > 0) {
    console.log(`   Errors: ${errorCount} companies`);
  }
  console.log(`   Kept: OpenRouter`);
}

deleteFakeCompanies().catch(console.error);

