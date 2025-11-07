import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as readline from 'readline';
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
 * Try to extract structured company data directly from HTML using AI
 */
async function extractStructuredCompanyData(html: string): Promise<CompanyData[]> {
  console.log('🤖 Attempting to extract structured company data from HTML...');
  
  // Truncate HTML if too long (keep first 100k chars for structured extraction)
  const truncatedHtml = html.length > 100000 ? html.substring(0, 100000) + '...' : html;
  
  const prompt = `You are a data extraction assistant. Analyze the following HTML content and extract structured company information.

HTML Content:
${truncatedHtml}

Instructions:
1. If the HTML contains a table, list, or structured data with company information, extract it
2. Extract the first 20 companies with as much detail as possible
3. For each company, extract:
   - name: Company name (required)
   - website: Website URL if present
   - linkedin_url: LinkedIn URL if present
   - description: Company description if present
   - industry: Industry/sector if present
   - employee_count: Number of employees if present (as integer)
   - headquarters: Location/headquarters if present
   - founding_date: Founded year if present (format as YYYY-MM-DD, e.g., "2010-01-01")
   - funding_amount: Funding amount if present (as number in USD, e.g., 5000000 for $5M)

4. Return ONLY valid JSON in this format:
{
  "companies": [
    {
      "name": "Company Name",
      "website": "https://example.com" or null,
      "linkedin_url": "https://linkedin.com/company/example" or null,
      "description": "Description" or null,
      "industry": "Industry" or null,
      "employee_count": 150 or null,
      "headquarters": "City, State" or null,
      "founding_date": "2010-01-01" or null,
      "funding_amount": 5000000 or null
    },
    ...
  ]
}

5. If the HTML doesn't contain structured company data, return: {"companies": []}
6. Only extract data that is clearly present in the HTML - don't make up information`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that extracts structured company data from HTML. Return only valid JSON.',
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
      return [];
    }

    const parsed = JSON.parse(content);
    if (parsed.companies && Array.isArray(parsed.companies) && parsed.companies.length > 0) {
      console.log(`✅ Extracted ${parsed.companies.length} companies with structured data`);
      return parsed.companies.slice(0, 20).filter((c: any) => c.name);
    }
    
    return [];
  } catch (error: any) {
    console.log(`⚠️  Could not extract structured data: ${error.message}`);
    return [];
  }
}

/**
 * Extract company names from HTML content using OpenAI
 */
async function extractCompanyNames(html: string): Promise<string[]> {
  console.log('🤖 Using AI to extract company names from HTML...');
  
  // Truncate HTML if too long (keep first 50k chars to avoid token limits)
  const truncatedHtml = html.length > 50000 ? html.substring(0, 50000) + '...' : html;
  
  const prompt = `You are a data extraction assistant. Analyze the following HTML content and extract a list of company names.

HTML Content:
${truncatedHtml}

Instructions:
1. Identify all company names mentioned in the HTML
2. Return ONLY the company names, one per line
3. Clean up the names (remove extra whitespace, HTML entities, etc.)
4. Do NOT include:
   - Generic words like "Company", "Inc", "LLC" unless they're part of the actual company name
   - URLs or email addresses
   - Column headers or labels
   - Numbers or dates
5. Return the first 20 unique company names you find
6. Return ONLY the company names, one per line, no numbering, no explanations

Example output format:
Apple
Microsoft
Google
Amazon
...`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that extracts company names from HTML. Return only the company names, one per line.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      console.log('⚠️  No response from OpenAI, falling back to basic extraction');
      return fallbackExtractCompanyNames(html);
    }

    // Parse the response - should be one company name per line
    const companyNames = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.match(/^\d+\.?\s*$/) && line.length < 100)
      .slice(0, 20);

    return companyNames;
  } catch (error: any) {
    console.log(`⚠️  Error extracting with AI: ${error.message}, falling back to basic extraction`);
    return fallbackExtractCompanyNames(html);
  }
}

/**
 * Fallback: Basic regex-based extraction
 */
function fallbackExtractCompanyNames(html: string): string[] {
  const companyNames: string[] = [];
  
  // Remove script and style tags
  const cleanHtml = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  
  // Extract text from common company listing patterns
  const companyPatterns = [
    /<a[^>]*>([^<]{2,50})<\/a>/gi,
    /<div[^>]*class="[^"]*company[^"]*"[^>]*>([^<]{2,50})<\/div>/gi,
    /<span[^>]*class="[^"]*company[^"]*"[^>]*>([^<]{2,50})<\/span>/gi,
    /<td[^>]*>([^<]{2,50})<\/td>/gi,
    /<li[^>]*>([^<]{2,50})<\/li>/gi,
  ];
  
  const foundNames = new Set<string>();
  
  for (const pattern of companyPatterns) {
    let match;
    while ((match = pattern.exec(cleanHtml)) !== null) {
      const text = match[1].trim();
      // Filter out common non-company text
      if (text.length > 2 && 
          text.length < 50 &&
          !text.match(/^(Company|Name|Website|LinkedIn|Description|Industry|Employees|Location|Founded|Funding)$/i) &&
          !text.match(/^https?:\/\//) &&
          !text.match(/^[0-9]+$/) &&
          !text.match(/^[A-Z]{1,2}$/)) {
        foundNames.add(text);
      }
    }
  }
  
  // Also try to extract from structured data (JSON-LD, etc.)
  const jsonLdPattern = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let jsonMatch;
  while ((jsonMatch = jsonLdPattern.exec(html)) !== null) {
    try {
      const jsonData = JSON.parse(jsonMatch[1]);
      if (Array.isArray(jsonData)) {
        jsonData.forEach((item: any) => {
          if (item.name && typeof item.name === 'string') {
            foundNames.add(item.name);
          }
        });
      } else if (jsonData.name && typeof jsonData.name === 'string') {
        foundNames.add(jsonData.name);
      }
    } catch (e) {
      // Ignore JSON parse errors
    }
  }
  
  return Array.from(foundNames).slice(0, 20);
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
      console.log(`  ✅ Found: ${Object.keys(data).filter(k => data[k] !== null).length} fields`);
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
  let htmlContent = '';

  // Get HTML from command line argument (file path, or direct HTML string if starts with '<')
  const args = process.argv.slice(2);
  
  if (args.length > 0) {
    const arg = args.join(' ');
    // Check if it's a file path or HTML content
    if (arg.trim().startsWith('<') || arg.includes('<html') || arg.includes('<HTML')) {
      // It's HTML content
      htmlContent = arg;
      console.log('Reading HTML from command line argument...');
    } else {
      // It's a file path
      const filePath = arg;
      console.log(`Reading HTML from file: ${filePath}`);
      htmlContent = fs.readFileSync(filePath, 'utf-8');
    }
  } else {
    // Read from stdin
    console.log('Reading HTML from stdin...');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const lines: string[] = [];
    for await (const line of rl) {
      lines.push(line);
    }
    htmlContent = lines.join('\n');
  }

  if (!htmlContent.trim()) {
    console.error('No HTML content provided');
    process.exit(1);
  }

  console.log(`\n📄 HTML content length: ${htmlContent.length} characters`);
  
  // First, try to extract structured company data directly from HTML
  console.log('\n🔎 Step 1: Attempting structured extraction from HTML...');
  const structuredCompanies = await extractStructuredCompanyData(htmlContent);
  
  let companiesToProcess: CompanyData[] = [];
  
  if (structuredCompanies.length > 0) {
    // Use structured data - only enrich missing fields
    console.log(`✅ Found ${structuredCompanies.length} companies with structured data`);
    companiesToProcess = structuredCompanies.slice(0, 20);
    
    // Enrich companies that are missing key fields
    console.log('\n🔎 Step 2: Enriching companies with missing data...');
    for (let i = 0; i < companiesToProcess.length; i++) {
      const company = companiesToProcess[i];
      const hasCompleteData = company.website && company.description && company.industry;
      
      if (!hasCompleteData) {
        console.log(`\n[${i + 1}/${companiesToProcess.length}] Enriching: ${company.name}`);
        const enrichedData = await enrichCompany(company.name);
        
        // Merge enriched data, but prefer existing structured data
        companiesToProcess[i] = {
          ...company,
          website: company.website || enrichedData.website,
          linkedin_url: company.linkedin_url || enrichedData.linkedin_url,
          description: company.description || enrichedData.description,
          industry: company.industry || enrichedData.industry,
          employee_count: company.employee_count || enrichedData.employee_count,
          headquarters: company.headquarters || enrichedData.headquarters,
          founding_date: company.founding_date || enrichedData.founding_date,
          funding_amount: company.funding_amount || enrichedData.funding_amount,
        };
        
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  } else {
    // Fall back to extracting names and enriching
    console.log('⚠️  No structured data found, extracting company names...');
    const companyNames = await extractCompanyNames(htmlContent);
    
    if (companyNames.length === 0) {
      console.log('❌ No company names found in HTML');
      console.log('\n💡 Tip: Make sure the HTML contains company names in recognizable patterns.');
      console.log('   You can also paste HTML directly or provide a file path as an argument.');
      process.exit(1);
    }

    console.log(`✅ Found ${companyNames.length} potential companies:`);
    companyNames.forEach((name, i) => {
      console.log(`   ${i + 1}. ${name}`);
    });

    // Process first 20 companies
    const namesToProcess = companyNames.slice(0, 20);
    console.log(`\n🚀 Processing first ${namesToProcess.length} companies...\n`);

    for (let i = 0; i < namesToProcess.length; i++) {
      const companyName = namesToProcess[i];
      console.log(`\n[${i + 1}/${namesToProcess.length}] Processing: ${companyName}`);
      
      // Enrich company data
      const enrichedData = await enrichCompany(companyName);
      
      // Combine with company name
      companiesToProcess.push({
        name: companyName,
        ...enrichedData,
      });

      // Add a small delay to avoid rate limiting
      if (i < namesToProcess.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  // Save all companies to database
  console.log(`\n💾 Saving ${companiesToProcess.length} companies to database...\n`);
  
  const results = {
    success: 0,
    failed: 0,
    skipped: 0,
  };

  for (let i = 0; i < companiesToProcess.length; i++) {
    const companyData = companiesToProcess[i];
    console.log(`\n[${i + 1}/${companiesToProcess.length}] Saving: ${companyData.name}`);
    
    // Insert into database
    const companyId = await insertCompany(companyData);
    
    if (companyId) {
      results.success++;
      console.log(`  ✅ Successfully saved (ID: ${companyId})`);
    } else {
      results.failed++;
      console.log(`  ❌ Failed to save`);
    }
  }

  console.log(`\n\n📊 Summary:`);
  console.log(`   ✅ Successfully processed: ${results.success}`);
  console.log(`   ❌ Failed: ${results.failed}`);
  console.log(`\n✨ Done!`);
}

main().catch(console.error);

