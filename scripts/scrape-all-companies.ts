/**
 * Batch Company Scraping Script
 * 
 * Scrapes all companies from the database and enriches them with data from:
 * - Crunchbase (funding, founders, financials)
 * - LinkedIn (employees, contacts, company info)
 * - Company websites (about pages, team pages)
 * 
 * Usage:
 *   tsx scripts/scrape-all-companies.ts                    # Scrape all companies
 *   tsx scripts/scrape-all-companies.ts --limit 10        # Scrape first 10
 *   tsx scripts/scrape-all-companies.ts --company-ids id1,id2  # Scrape specific companies
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from "@supabase/supabase-js";
import { enrichCompanyWithAI, EnrichedCompanyData, EnrichedContact } from "../lib/services/company-ai-enrichment";

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing Supabase credentials");
  console.error("   Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface ScrapingOptions {
  limit?: number;
  companyIds?: string[];
}

/**
 * Update company table with enriched overview data
 */
async function updateCompanyData(
  companyId: string,
  data: EnrichedCompanyData
): Promise<void> {
  const updateData: any = {};

  if (data.website) updateData.website = data.website;
  if (data.description) updateData.description = data.description;
  if (data.industry) updateData.industry = data.industry;
  if (data.employee_count) updateData.employee_count = data.employee_count;
  if (data.headquarters) updateData.headquarters = data.headquarters;
  if (data.founding_date) updateData.founding_date = data.founding_date;
  if (data.linkedin_url) updateData.linkedin_url = data.linkedin_url;
  if (data.twitter_handle) updateData.twitter_handle = data.twitter_handle;
  if (data.funding_amount) updateData.funding_amount = data.funding_amount;
  if (data.funding_round) updateData.funding_round = data.funding_round;

  if (Object.keys(updateData).length > 0) {
    const { error } = await supabase
      .from("companies")
      .update(updateData)
      .eq("id", companyId);

    if (error) {
      throw new Error(`Failed to update company: ${error.message}`);
    }
  }
}

/**
 * Update contacts table with enriched people data
 */
async function updateContacts(
  companyId: string,
  contacts: EnrichedContact[]
): Promise<void> {
  if (!contacts || contacts.length === 0) return;

  for (const contact of contacts) {
    // Check if contact already exists
    const { data: existing } = await supabase
      .from("contacts")
      .select("id")
      .eq("company_id", companyId)
      .eq("first_name", contact.first_name)
      .eq("last_name", contact.last_name)
      .maybeSingle();

    const contactData: any = {
      company_id: companyId,
      first_name: contact.first_name,
      last_name: contact.last_name,
    };

    if (contact.title) contactData.title = contact.title;
    if (contact.email) contactData.email = contact.email;
    if (contact.phone) contactData.phone = contact.phone;

    if (existing) {
      // Update existing contact
      const { error } = await supabase
        .from("contacts")
        .update(contactData)
        .eq("id", existing.id);

      if (error) {
        console.error(`  ⚠️  Failed to update contact ${contact.first_name} ${contact.last_name}: ${error.message}`);
      }
    } else {
      // Insert new contact
      const { error } = await supabase
        .from("contacts")
        .insert(contactData);

      if (error) {
        console.error(`  ⚠️  Failed to insert contact ${contact.first_name} ${contact.last_name}: ${error.message}`);
      }
    }
  }
}

/**
 * Update financials table with enriched financial data
 */
async function updateFinancials(
  companyId: string,
  data: EnrichedCompanyData
): Promise<void> {
  const currentYear = new Date().getFullYear();

  // Update ARR/revenue if available
  if (data.arr || data.revenue) {
    const { data: existing } = await supabase
      .from("company_financials")
      .select("id")
      .eq("company_id", companyId)
      .eq("year", currentYear)
      .maybeSingle();

    const financialData: any = {
      company_id: companyId,
      year: currentYear,
    };

    if (data.arr) financialData.arr = data.arr;
    // Note: revenue field doesn't exist in schema, but we could add it or use metadata

    if (existing) {
      await supabase
        .from("company_financials")
        .update(financialData)
        .eq("id", existing.id);
    } else {
      await supabase
        .from("company_financials")
        .insert(financialData);
    }
  }

  // Store funding rounds in metadata
  if (data.funding_rounds && data.funding_rounds.length > 0) {
    await supabase
      .from("company_metadata")
      .upsert({
        company_id: companyId,
        key: "funding_rounds",
        value_json: data.funding_rounds,
      }, {
        onConflict: "company_id,key",
      });
  }
}

/**
 * Store enrichment metadata
 */
async function updateScrapingMetadata(
  companyId: string,
  data: EnrichedCompanyData
): Promise<void> {
  await supabase
    .from("company_metadata")
    .upsert({
      company_id: companyId,
      key: "scraping_metadata",
      value_json: {
        sources: data.sources || [],
        scraped_at: data.scraped_at,
        last_scraped: new Date().toISOString(),
      },
    }, {
      onConflict: "company_id,key",
    });
}

/**
 * Process a single company with retry logic
 */
async function processCompany(company: any, index: number, total: number): Promise<boolean> {
  console.log(`\n[${index + 1}/${total}] Processing: ${company.name}`);
  console.log(`  ID: ${company.id}`);
  console.log(`  Website: ${company.website || "N/A"}`);
  console.log(`  LinkedIn: ${company.linkedin_url || "N/A"}`);

  const maxRetries = 2;
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 1) {
        console.log(`  🔄 Retry attempt ${attempt}/${maxRetries}...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }

      // Enrich company data using AI
      console.log(`  🤖 Enriching with AI from multiple sources...`);
      const enrichedData = await enrichCompanyWithAI(
        company.name,
        company.website,
        company.linkedin_url
      );

      if (!enrichedData || (!enrichedData.website && !enrichedData.description && !enrichedData.contacts?.length)) {
        console.log(`  ⚠️  No data found from any source`);
        return false;
      }

      console.log(`  ✅ Enriched data from: ${enrichedData.sources?.join(", ") || "unknown"}`);

      // Update database with transaction-like error handling
      console.log(`  💾 Updating database...`);

      try {
        await updateCompanyData(company.id, enrichedData);
        console.log(`    ✓ Company data updated`);
        if (enrichedData.description) {
          console.log(`    📝 Description: ${enrichedData.description.substring(0, 100)}...`);
        }
      } catch (error: any) {
        console.error(`    ⚠️  Failed to update company data: ${error.message}`);
      }

      try {
        if (enrichedData.contacts && enrichedData.contacts.length > 0) {
          await updateContacts(company.id, enrichedData.contacts);
          console.log(`    ✓ Added/updated ${enrichedData.contacts.length} contacts`);
          
          // Show founders
          const founders = enrichedData.contacts.filter(c => c.is_founder);
          if (founders.length > 0) {
            console.log(`    📌 Founders: ${founders.map(f => `${f.first_name} ${f.last_name}${f.email ? ` (${f.email})` : ""}`).join(", ")}`);
          }
        }
      } catch (error: any) {
        console.error(`    ⚠️  Failed to update contacts: ${error.message}`);
      }

      try {
        if (enrichedData.funding_amount || enrichedData.funding_rounds) {
          await updateFinancials(company.id, enrichedData);
          console.log(`    ✓ Financial data updated`);
          if (enrichedData.funding_amount) {
            console.log(`    💰 Total funding: $${(enrichedData.funding_amount / 1000000).toFixed(2)}M`);
          }
          if (enrichedData.funding_rounds && enrichedData.funding_rounds.length > 0) {
            console.log(`    📊 Funding rounds: ${enrichedData.funding_rounds.length}`);
          }
        }
      } catch (error: any) {
        console.error(`    ⚠️  Failed to update financials: ${error.message}`);
      }

      try {
        await updateScrapingMetadata(company.id, enrichedData);
        console.log(`    ✓ Metadata updated`);
      } catch (error: any) {
        console.error(`    ⚠️  Failed to update metadata: ${error.message}`);
      }

      return true;
    } catch (error: any) {
      lastError = error;
      console.error(`  ❌ Attempt ${attempt} failed: ${error.message}`);
      
      // Don't retry on certain errors
      if (error.message.includes('timeout') || error.message.includes('404') || error.message.includes('not found')) {
        console.log(`  ⚠️  Non-retryable error, skipping retries`);
        break;
      }
    }
  }

  console.error(`  ❌ All attempts failed. Last error: ${lastError?.message}`);
  return false;
}

/**
 * Main scraping function
 */
async function scrapeAllCompanies(options: ScrapingOptions = {}) {
  console.log("\n🚀 Starting batch company enrichment with AI...\n");

  // Fetch companies
  let query = supabase.from("companies").select("id, name, website, linkedin_url").order("created_at", { ascending: false });

  if (options.companyIds && options.companyIds.length > 0) {
    query = query.in("id", options.companyIds);
  }

  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data: companies, error } = await query;

  if (error) {
    console.error("❌ Error fetching companies:", error);
    process.exit(1);
  }

  if (!companies || companies.length === 0) {
    console.log("ℹ️  No companies found");
    return;
  }

  console.log(`📊 Found ${companies.length} companies to enrich\n`);

  const results = {
    success: 0,
    failed: 0,
    noData: 0,
    errors: [] as Array<{ company: string; error: string }>,
  };

  const startTime = Date.now();
  const progressInterval = setInterval(() => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const processed = results.success + results.failed;
    const remaining = companies.length - processed;
    const avgTime = processed > 0 ? (parseFloat(elapsed) / processed).toFixed(1) : "0";
    const eta = remaining > 0 ? (parseFloat(avgTime) * remaining).toFixed(0) : "0";
    process.stdout.write(`\r⏱️  Progress: ${processed}/${companies.length} | Success: ${results.success} | Failed: ${results.failed} | ETA: ${eta}s`);
  }, 1000);

  for (let i = 0; i < companies.length; i++) {
    const company = companies[i];
    const success = await processCompany(company, i, companies.length);

    if (success) {
      results.success++;
    } else {
      results.failed++;
      results.errors.push({
        company: company.name,
        error: "Enrichment failed or no data found",
      });
    }

    // Minimal delay between companies (prioritizing speed as requested)
    if (i < companies.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 200)); // 200ms delay
    }
  }

  clearInterval(progressInterval);

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log("\n\n📊 Enrichment Summary:");
  console.log(`   ✅ Successfully enriched: ${results.success}`);
  console.log(`   ❌ Failed: ${results.failed}`);
  console.log(`   ⏱️  Total time: ${duration}s`);
  console.log(`   📈 Average: ${(parseFloat(duration) / companies.length).toFixed(1)}s per company`);
  
  if (results.errors.length > 0 && results.errors.length <= 10) {
    console.log(`\n   ⚠️  Failed companies:`);
    results.errors.forEach(({ company, error }) => {
      console.log(`      - ${company}: ${error}`);
    });
  } else if (results.errors.length > 10) {
    console.log(`\n   ⚠️  ${results.errors.length} companies failed (too many to list)`);
  }
  
  console.log("\n✨ Done!\n");
}

// Parse command line arguments
const args = process.argv.slice(2);
const options: ScrapingOptions = {};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "--limit" && args[i + 1]) {
    options.limit = parseInt(args[i + 1], 10);
    i++;
  } else if (arg === "--company-ids" && args[i + 1]) {
    options.companyIds = args[i + 1].split(",").map(id => id.trim());
    i++;
  } else if (arg === "--help") {
    console.log(`
Usage: tsx scripts/scrape-all-companies.ts [options]

Options:
  --limit <number>           Limit number of companies to scrape
  --company-ids <ids>         Comma-separated list of company IDs to scrape
  --help                     Show this help message

Examples:
  tsx scripts/scrape-all-companies.ts
  tsx scripts/scrape-all-companies.ts --limit 10
  tsx scripts/scrape-all-companies.ts --company-ids "id1,id2,id3"
    `);
    process.exit(0);
  }
}

// Run scraping
scrapeAllCompanies(options).catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

