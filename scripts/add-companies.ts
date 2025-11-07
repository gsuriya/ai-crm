import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const openaiApiKey = process.env.OPENAI_API_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables');
  process.exit(1);
}

if (!openaiApiKey) {
  console.error('Please set OPENAI_API_KEY environment variable');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const openai = new OpenAI({ apiKey: openaiApiKey });

interface CompanyData {
  name: string;
  website?: string;
  linkedin_url?: string;
  description?: string;
  industry?: string;
  employee_count?: number;
  headquarters?: string;
  founding_date?: string; // ISO date string
  funding_amount?: number;
}

/**
 * Enrich company data using OpenAI
 */
async function enrichCompany(companyName: string): Promise<Partial<CompanyData>> {
  console.log(`\n🔍 Enriching: ${companyName}`);
  
  const prompt = `You are a company data enrichment assistant. Given a company name, provide structured information in JSON format.

Company Name: "${companyName}"

Please provide the following information if available:
- website: The company's main website URL (e.g., "https://example.com")
- linkedin_url: The company's LinkedIn page URL (e.g., "https://linkedin.com/company/example")
- description: A brief description of what the company does (1-2 sentences)
- industry: The primary industry or sector (e.g., "Software", "Healthcare", "Finance")
- employee_count: Approximate number of employees (as a number, e.g., 150)
- headquarters: City and state/country (e.g., "San Francisco, CA" or "New York, NY")
- founding_date: Year the company was founded (as YYYY-MM-DD format, e.g., "2010-01-01")
- funding_amount: Total funding amount in USD (as a number, e.g., 5000000 for $5M)

Return ONLY valid JSON in this format:
{
  "website": "https://example.com" or null,
  "linkedin_url": "https://linkedin.com/company/example" or null,
  "description": "Brief description" or null,
  "industry": "Industry name" or null,
  "employee_count": 150 or null,
  "headquarters": "City, State" or null,
  "founding_date": "2010-01-01" or null,
  "funding_amount": 5000000 or null
}

If you cannot find information for a field, use null. Be accurate and only include information you're confident about.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that provides accurate company information in JSON format. Only return valid JSON, no additional text.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      console.log(`  ⚠️  No response from OpenAI`);
      return {};
    }

    try {
      const data = JSON.parse(content);
      const foundFields = Object.keys(data).filter(k => data[k] !== null);
      console.log(`  ✅ Found: ${foundFields.length} fields (${foundFields.join(', ')})`);
      return data;
    } catch (e) {
      console.log(`  ⚠️  Failed to parse JSON response`);
      return {};
    }
  } catch (error: any) {
    console.log(`  ❌ Error: ${error.message}`);
    return {};
  }
}

/**
 * Insert company into database
 */
async function insertCompany(data: CompanyData): Promise<string | null> {
  try {
    // Check if company already exists
    const { data: existing } = await supabase
      .from('companies')
      .select('id')
      .ilike('name', data.name)
      .limit(1)
      .maybeSingle();

    if (existing) {
      console.log(`  ℹ️  Company already exists, updating...`);
      const { data: updated, error } = await supabase
        .from('companies')
        .update({
          website: data.website || null,
          linkedin_url: data.linkedin_url || null,
          description: data.description || null,
          industry: data.industry || null,
          employee_count: data.employee_count || null,
          headquarters: data.headquarters || null,
          founding_date: data.founding_date || null,
          funding_amount: data.funding_amount || null,
        })
        .eq('id', existing.id)
        .select('id')
        .single();

      if (error) {
        console.log(`  ❌ Update error: ${error.message}`);
        return null;
      }
      return updated?.id || null;
    } else {
      const { data: inserted, error } = await supabase
        .from('companies')
        .insert({
          name: data.name,
          website: data.website || null,
          linkedin_url: data.linkedin_url || null,
          description: data.description || null,
          industry: data.industry || null,
          employee_count: data.employee_count || null,
          headquarters: data.headquarters || null,
          founding_date: data.founding_date || null,
          funding_amount: data.funding_amount || null,
        })
        .select('id')
        .single();

      if (error) {
        console.log(`  ❌ Insert error: ${error.message}`);
        return null;
      }
      return inserted?.id || null;
    }
  } catch (error: any) {
    console.log(`  ❌ Database error: ${error.message}`);
    return null;
  }
}

/**
 * Main function
 */
async function main() {
  const companyNames = [
    'databricks',
    'wiz',
    'flank',
    'writer',
    'assemblyAI',
    'atlan',
    'calm',
    'crewAI',
    'weights & biases',
    'pactum',
    'E2B',
    'zest',
    'checkout.com',
    'udemy',
    'alma',
    'amcs',
    'armis',
    'augury',
  ];

  console.log(`\n🚀 Processing ${companyNames.length} companies...\n`);

  const results = {
    success: 0,
    failed: 0,
    skipped: 0,
  };

  for (let i = 0; i < companyNames.length; i++) {
    const companyName = companyNames[i];
    console.log(`\n[${i + 1}/${companyNames.length}] Processing: ${companyName}`);

    // Enrich company data
    const enrichedData = await enrichCompany(companyName);

    // Combine with company name
    const companyData: CompanyData = {
      name: companyName,
      ...enrichedData,
    };

    // Insert into database
    const companyId = await insertCompany(companyData);

    if (companyId) {
      results.success++;
      console.log(`  ✅ Successfully saved (ID: ${companyId})`);
    } else {
      results.failed++;
      console.log(`  ❌ Failed to save`);
    }

    // Add a small delay to avoid rate limiting
    if (i < companyNames.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log(`\n\n📊 Summary:`);
  console.log(`   ✅ Successfully processed: ${results.success}`);
  console.log(`   ❌ Failed: ${results.failed}`);
  console.log(`\n✨ Done!`);
}

main().catch(console.error);

