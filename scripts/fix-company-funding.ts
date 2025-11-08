/**
 * Fix Company Funding Amounts Script
 * 
 * Uses GPT to find accurate funding amounts for all companies and updates the database.
 * This replaces incorrect funding data with accurate amounts found using GPT's knowledge.
 * 
 * Usage:
 *   tsx scripts/fix-company-funding.ts                    # Fix all companies
 *   tsx scripts/fix-company-funding.ts --limit 10        # Fix first 10
 *   tsx scripts/fix-company-funding.ts --company-ids id1,id2  # Fix specific companies
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from "@supabase/supabase-js";
import { findFundingAmountWithGPT } from "../lib/services/company-ai-enrichment";

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

interface FixOptions {
  limit?: number;
  companyIds?: string[];
}

/**
 * Update company funding amount in database
 */
async function updateCompanyFunding(
  companyId: string,
  fundingAmount: number
): Promise<void> {
  const { error } = await supabase
    .from("companies")
    .update({ funding_amount: fundingAmount })
    .eq("id", companyId);

  if (error) {
    throw new Error(`Failed to update funding: ${error.message}`);
  }
}

/**
 * Process a single company to fix funding amount
 */
async function fixCompanyFunding(company: any, index: number, total: number): Promise<boolean> {
  console.log(`\n[${index + 1}/${total}] Fixing funding for: ${company.name}`);
  console.log(`  ID: ${company.id}`);
  console.log(`  Current funding: ${company.funding_amount ? `$${(company.funding_amount / 1000000).toFixed(2)}M` : 'N/A'}`);
  console.log(`  Website: ${company.website || "N/A"}`);

  try {
    // Use GPT to find accurate funding amount
    console.log(`  🤖 Searching for accurate funding amount with GPT...`);
    const accurateFunding = await findFundingAmountWithGPT(company.name, company.website);

    if (!accurateFunding) {
      console.log(`  ⚠️  Could not find funding amount`);
      return false;
    }

    const fundingInMillions = (accurateFunding / 1000000).toFixed(2);
    console.log(`  ✅ Found funding: $${fundingInMillions}M`);

    // Check if funding amount changed
    if (company.funding_amount && Math.abs(company.funding_amount - accurateFunding) < 1000) {
      console.log(`  ℹ️  Funding amount is already correct, no update needed`);
      return true;
    }

    // Update database
    console.log(`  💾 Updating database...`);
    await updateCompanyFunding(company.id, accurateFunding);
    console.log(`  ✅ Successfully updated funding amount`);

    if (company.funding_amount) {
      const oldFunding = (company.funding_amount / 1000000).toFixed(2);
      console.log(`  📊 Changed from $${oldFunding}M to $${fundingInMillions}M`);
    }

    return true;
  } catch (error: any) {
    console.error(`  ❌ Error: ${error.message}`);
    return false;
  }
}

/**
 * Main function to fix all company funding amounts
 */
async function fixAllCompanyFunding(options: FixOptions = {}) {
  console.log("\n🚀 Starting company funding fix with GPT...\n");

  // Fetch companies
  let query = supabase
    .from("companies")
    .select("id, name, website, funding_amount")
    .order("created_at", { ascending: false });

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

  console.log(`📊 Found ${companies.length} companies to fix\n`);

  const results = {
    success: 0,
    failed: 0,
    unchanged: 0,
    errors: [] as Array<{ company: string; error: string }>,
  };

  const startTime = Date.now();
  const progressInterval = setInterval(() => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const processed = results.success + results.failed + results.unchanged;
    const remaining = companies.length - processed;
    const avgTime = processed > 0 ? (parseFloat(elapsed) / processed).toFixed(1) : "0";
    const eta = remaining > 0 ? (parseFloat(avgTime) * remaining).toFixed(0) : "0";
    process.stdout.write(`\r⏱️  Progress: ${processed}/${companies.length} | Fixed: ${results.success} | Failed: ${results.failed} | Unchanged: ${results.unchanged} | ETA: ${eta}s`);
  }, 1000);

  for (let i = 0; i < companies.length; i++) {
    const company = companies[i];
    const success = await fixCompanyFunding(company, i, companies.length);

    if (success) {
      // Check if funding was actually updated
      if (company.funding_amount) {
        const { data: updated } = await supabase
          .from("companies")
          .select("funding_amount")
          .eq("id", company.id)
          .single();
        
        if (updated && Math.abs((updated.funding_amount || 0) - company.funding_amount) < 1000) {
          results.unchanged++;
        } else {
          results.success++;
        }
      } else {
        results.success++;
      }
    } else {
      results.failed++;
      results.errors.push({
        company: company.name,
        error: "Failed to find or update funding",
      });
    }

    // Delay between companies to avoid rate limits
    if (i < companies.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000)); // 1 second delay
    }
  }

  clearInterval(progressInterval);

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log("\n\n📊 Funding Fix Summary:");
  console.log(`   ✅ Successfully fixed: ${results.success}`);
  console.log(`   ℹ️  Unchanged (already correct): ${results.unchanged}`);
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
const options: FixOptions = {};

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
Usage: tsx scripts/fix-company-funding.ts [options]

Options:
  --limit <number>           Limit number of companies to fix
  --company-ids <ids>        Comma-separated list of company IDs to fix
  --help                    Show this help message

Examples:
  tsx scripts/fix-company-funding.ts
  tsx scripts/fix-company-funding.ts --limit 10
  tsx scripts/fix-company-funding.ts --company-ids "id1,id2,id3"
    `);
    process.exit(0);
  }
}

// Run fixing
fixAllCompanyFunding(options).catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

