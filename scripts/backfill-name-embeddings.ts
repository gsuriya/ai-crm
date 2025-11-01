import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';
import { generateEmbedding } from '../lib/embeddings';

// Load .env.local file
config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const openaiKey = process.env.OPENAI_API_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables');
  process.exit(1);
}

if (!openaiKey) {
  console.error('Please set OPENAI_API_KEY environment variable');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function backfillCompanyNameEmbeddings() {
  console.log('Starting to backfill company name embeddings...');

  // Get all companies without name embeddings
  const { data: companies } = await supabase
    .from('companies')
    .select('id, name')
    .is('name_embedding', null);

  if (!companies || companies.length === 0) {
    console.log('No companies found without name embeddings.');
    return;
  }

  console.log(`Found ${companies.length} companies without name embeddings. Generating embeddings...`);

  for (const company of companies) {
    try {
      // Generate embedding for company name
      const { embedding: nameEmbedding } = await generateEmbedding(company.name);
      
      await supabase
        .from('companies')
        .update({ name_embedding: `[${nameEmbedding.join(',')}]` })
        .eq('id', company.id);

      console.log(`✓ Added embedding for ${company.name}`);
    } catch (error) {
      console.error(`✗ Error generating embedding for ${company.name}:`, error);
    }
  }

  console.log('Company name embeddings backfilled successfully!');
}

backfillCompanyNameEmbeddings();

