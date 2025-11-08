/**
 * Batch Company Enrichment Script
 * 
 * Enriches multiple companies using available data providers
 * 
 * Usage:
 *   tsx scripts/enrich-companies.ts                    # Enrich all companies
 *   tsx scripts/enrich-companies.ts --limit 10        # Enrich first 10
 *   tsx scripts/enrich-companies.ts --provider clearbit  # Use specific provider
 */

import { createClient } from "@supabase/supabase-js";
import { enrichCompany, saveEnrichedData } from "../lib/services/company-enrichment";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface EnrichmentOptions {
  limit?: number;
  provider?: "clearbit" | "crunchbase" | "pitchbook";
  companyIds?: string[];
  skipExisting?: boolean;
}

async function enrichCompanies(options: EnrichmentOptions = {}) {
  const { limit, provider, companyIds, skipExisting = true } = options;

  console.log("\n🚀 Starting company enrichment...\n");

  // Fetch companies
  let query = supabase.from("companies").select("id, name, website, domain");

  if (companyIds && companyIds.length > 0) {
    query = query.in("id", companyIds);
  }

  if (limit) {
    query = query.limit(limit);
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
    skipped: 0,
    noData: 0,
  };

  for (let i = 0; i < companies.length; i++) {
    const company = companies[i];
    console.log(`[${i + 1}/${companies.length}] Processing: ${company.name}`);

    try {
      // Check if company already has enrichment data
      if (skipExisting) {
        const { data: metadata } = await supabase
          .from("company_metadata")
          .select("key")
          .eq("company_id", company.id)
          .eq("key", "enrichment_metadata")
          .maybeSingle();

        if (metadata) {
          console.log(`  ⏭️  Already enriched, skipping`);
          results.skipped++;
          continue;
        }
      }

      // Extract domain from website if available
      const domain = company.domain || 
        (company.website 
          ? new URL(company.website).hostname.replace("www.", "")
          : undefined);

      // Enrich company
      const enrichedData = await enrichCompany(
        company.name,
        domain,
        provider
      );

      if (!enrichedData) {
        console.log(`  ⚠️  No data available from providers`);
        results.noData++;
        continue;
      }

      // Save enriched data
      await saveEnrichedData(supabase, company.id, enrichedData);

      console.log(`  ✅ Enriched using ${enrichedData.data_source || "unknown"}`);
      console.log(`     - Website: ${enrichedData.website || "N/A"}`);
      console.log(`     - Employees: ${enrichedData.employee_count || "N/A"}`);
      console.log(`     - Industry: ${enrichedData.industry || "N/A"}`);
      console.log(`     - Funding: ${enrichedData.funding_amount ? `$${(enrichedData.funding_amount / 1000000).toFixed(1)}M` : "N/A"}`);
      if (enrichedData.arr) {
        console.log(`     - ARR: $${(enrichedData.arr / 1000000).toFixed(1)}M`);
      }

      results.success++;

      // Rate limiting - be nice to APIs
      if (i < companies.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000)); // 1 second delay
      }
    } catch (error: any) {
      console.error(`  ❌ Error: ${error.message}`);
      results.failed++;
    }
  }

  console.log("\n\n📊 Enrichment Summary:");
  console.log(`   ✅ Successfully enriched: ${results.success}`);
  console.log(`   ⚠️  No data available: ${results.noData}`);
  console.log(`   ⏭️  Skipped (already enriched): ${results.skipped}`);
  console.log(`   ❌ Failed: ${results.failed}`);
  console.log("\n✨ Done!\n");
}

// Parse command line arguments
const args = process.argv.slice(2);
const options: EnrichmentOptions = {};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "--limit" && args[i + 1]) {
    options.limit = parseInt(args[i + 1], 10);
    i++;
  } else if (arg === "--provider" && args[i + 1]) {
    const provider = args[i + 1] as "clearbit" | "crunchbase" | "pitchbook";
    if (["clearbit", "crunchbase", "pitchbook"].includes(provider)) {
      options.provider = provider;
    } else {
      console.error(`❌ Invalid provider: ${provider}`);
      console.log("Valid providers: clearbit, crunchbase, pitchbook");
      process.exit(1);
    }
    i++;
  } else if (arg === "--company-ids" && args[i + 1]) {
    options.companyIds = args[i + 1].split(",");
    i++;
  } else if (arg === "--no-skip") {
    options.skipExisting = false;
  } else if (arg === "--help") {
    console.log(`
Usage: tsx scripts/enrich-companies.ts [options]

Options:
  --limit <number>           Limit number of companies to enrich
  --provider <name>          Use specific provider (clearbit, crunchbase, pitchbook)
  --company-ids <ids>        Comma-separated list of company IDs to enrich
  --no-skip                  Don't skip already enriched companies
  --help                     Show this help message

Examples:
  tsx scripts/enrich-companies.ts
  tsx scripts/enrich-companies.ts --limit 10
  tsx scripts/enrich-companies.ts --provider clearbit
  tsx scripts/enrich-companies.ts --company-ids "id1,id2,id3"
    `);
    process.exit(0);
  }
}

// Run enrichment
enrichCompanies(options).catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

