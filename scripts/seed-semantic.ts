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

async function seedSemanticSearchData() {
  console.log('Starting semantic search data seed...');

  // Get all companies
  const { data: companies } = await supabase
    .from('companies')
    .select('id, name');

  if (!companies || companies.length === 0) {
    console.log('No companies found. Please seed companies first.');
    return;
  }

  console.log(`Found ${companies.length} companies. Adding sample content...`);

  // Add sample content for each company
  for (const company of companies.slice(0, 5)) { // Limit to first 5 for demo
    // Generate embedding for company name
    const { embedding: nameEmbedding } = await generateEmbedding(company.name);
    
    await supabase
      .from('companies')
      .update({ name_embedding: `[${nameEmbedding.join(',')}]` })
      .eq('id', company.id);

    // Add meeting log
    const meetingContent = `Meeting with ${company.name} team on Q4 strategy. Discussed ARR growth targets and potential funding round. Company mentioned they are looking to raise $5M-$10M Series A.`;
    const { embedding: meetingEmbedding } = await generateEmbedding(meetingContent);

    await supabase.from('company_content').insert({
      company_id: company.id,
      content_type: 'meeting_log',
      content: meetingContent,
      source: 'Internal CRM',
      metadata: {
        title: `Q4 Strategy Meeting - ${company.name}`,
        date: new Date().toISOString(),
      },
      embedding: `[${meetingEmbedding.join(',')}]`,
    });

    // Add metadata with ARR
    const arrValue = Math.floor(Math.random() * 5000000) + 1000000; // Random ARR between 1M-6M
    const arrText = `ARR: $${(arrValue / 1000000).toFixed(2)}M`;
    const { embedding: arrEmbedding } = await generateEmbedding(arrText);

    await supabase.from('company_metadata').upsert({
      company_id: company.id,
      key: 'arr',
      value: arrText,
      value_numeric: arrValue,
      embedding: `[${arrEmbedding.join(',')}]`,
    });

    // Update company ARR field
    await supabase
      .from('companies')
      .update({ arr: arrValue })
      .eq('id', company.id);

    console.log(`Added content for ${company.name}`);
  }

  console.log('Semantic search data seeded successfully!');
}

seedSemanticSearchData();

