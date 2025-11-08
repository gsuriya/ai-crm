/**
 * Find and Add CEOs Script
 * 
 * Uses GPT to find the CEO name for each company and adds them to the contacts table.
 * 
 * Usage:
 *   tsx scripts/find-and-add-ceos.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from "@supabase/supabase-js";
import OpenAI from 'openai';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const openaiApiKey = process.env.OPENAI_API_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing Supabase credentials");
  process.exit(1);
}

if (!openaiApiKey) {
  console.error("❌ Missing OpenAI API key");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const openai = new OpenAI({ apiKey: openaiApiKey });

/**
 * Find CEO name using GPT
 */
async function findCEO(companyName: string, website?: string): Promise<{ firstName: string; lastName: string; title: string } | null> {
  try {
    const prompt = `Find the current CEO of "${companyName}"${website ? ` (website: ${website})` : ''}.

Return ONLY a JSON object in this exact format:
{
  "firstName": "First Name",
  "lastName": "Last Name",
  "title": "CEO"
}

If you cannot find the CEO, return null. Do not include any other text or explanation.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at finding company executive information. Return only valid JSON with CEO information.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0,
      response_format: { type: 'json_object' },
      max_tokens: 100,
    });

    const response = completion.choices[0]?.message?.content?.trim();
    if (!response) return null;

    const data = JSON.parse(response);
    
    // Check if null or invalid
    if (!data || data === null || !data.firstName || !data.lastName) {
      return null;
    }

    return {
      firstName: data.firstName,
      lastName: data.lastName,
      title: data.title || 'CEO',
    };
  } catch (error: any) {
    console.error(`Error finding CEO for ${companyName}:`, error.message);
    return null;
  }
}

/**
 * Add CEO to contacts table
 */
async function addCEO(
  companyId: string,
  firstName: string,
  lastName: string,
  title: string
): Promise<boolean> {
  try {
    // Check if CEO already exists
    const { data: existing } = await supabase
      .from("contacts")
      .select("id")
      .eq("company_id", companyId)
      .eq("first_name", firstName)
      .eq("last_name", lastName)
      .maybeSingle();

    if (existing) {
      // Update existing contact to ensure title is CEO
      const { error } = await supabase
        .from("contacts")
        .update({ title })
        .eq("id", existing.id);
      
      return !error;
    }

    // Insert new CEO contact
    const { error } = await supabase
      .from("contacts")
      .insert({
        company_id: companyId,
        first_name: firstName,
        last_name: lastName,
        title: title,
      });

    return !error;
  } catch (error: any) {
    console.error(`Error adding CEO:`, error.message);
    return false;
  }
}

/**
 * Main function to find and add CEOs
 */
async function findAndAddCEOs() {
  console.log("\n🚀 Starting CEO search and addition...\n");

  // Fetch all companies
  const { data: companies, error } = await supabase
    .from("companies")
    .select("id, name, website")
    .order("name", { ascending: true });

  if (error) {
    console.error("❌ Error fetching companies:", error);
    process.exit(1);
  }

  if (!companies || companies.length === 0) {
    console.log("ℹ️  No companies found");
    return;
  }

  console.log(`📊 Found ${companies.length} companies\n`);

  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < companies.length; i++) {
    const company = companies[i];
    
    // Check if CEO already exists
    const { data: existingCEO } = await supabase
      .from("contacts")
      .select("id, first_name, last_name")
      .eq("company_id", company.id)
      .or("title.ilike.%CEO%,title.ilike.%Chief Executive%")
      .maybeSingle();

    if (existingCEO) {
      console.log(`[${i + 1}/${companies.length}] ⏭️  ${company.name}: CEO already exists (${existingCEO.first_name} ${existingCEO.last_name})`);
      skipped++;
      continue;
    }

    console.log(`[${i + 1}/${companies.length}] 🔍 Finding CEO for: ${company.name}`);
    
    const ceo = await findCEO(company.name, company.website);

    if (!ceo) {
      console.log(`  ❌ Could not find CEO`);
      failed++;
      continue;
    }

    console.log(`  ✅ Found: ${ceo.firstName} ${ceo.lastName} (${ceo.title})`);

    const added = await addCEO(company.id, ceo.firstName, ceo.lastName, ceo.title);

    if (added) {
      console.log(`  ✅ Added to database`);
      success++;
    } else {
      console.log(`  ❌ Failed to add to database`);
      failed++;
    }

    // Delay to avoid rate limits
    if (i < companies.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  console.log("\n📊 CEO Addition Summary:");
  console.log(`   ✅ Successfully added: ${success}`);
  console.log(`   ⏭️  Skipped (already exists): ${skipped}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log("\n✨ Done!\n");
}

// Run
findAndAddCEOs().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

