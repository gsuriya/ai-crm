/**
 * Scatter Company Dates Script
 * 
 * Randomly distributes company created_at dates across August to November 2025
 * to make them look more realistic instead of all being November 7th.
 * 
 * Usage:
 *   tsx scripts/scatter-company-dates.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from "@supabase/supabase-js";

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

/**
 * Generate a random date between August 1, 2025 and November 30, 2025
 */
function getRandomDate(): Date {
  const start = new Date('2025-08-01T00:00:00Z');
  const end = new Date('2025-11-30T23:59:59Z');
  const randomTime = start.getTime() + Math.random() * (end.getTime() - start.getTime());
  return new Date(randomTime);
}

/**
 * Scatter company dates
 */
async function scatterDates() {
  console.log("\n🚀 Starting company date scattering...\n");

  // Fetch all companies
  const { data: companies, error } = await supabase
    .from("companies")
    .select("id, name, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("❌ Error fetching companies:", error);
    process.exit(1);
  }

  if (!companies || companies.length === 0) {
    console.log("ℹ️  No companies found");
    return;
  }

  console.log(`📊 Found ${companies.length} companies to update\n`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < companies.length; i++) {
    const company = companies[i];
    const randomDate = getRandomDate();
    const dateString = randomDate.toISOString();

    try {
      const { error: updateError } = await supabase
        .from("companies")
        .update({ created_at: dateString })
        .eq("id", company.id);

      if (updateError) {
        console.error(`[${i + 1}/${companies.length}] ❌ ${company.name}: ${updateError.message}`);
        failed++;
      } else {
        console.log(`[${i + 1}/${companies.length}] ✅ ${company.name}: ${randomDate.toLocaleDateString()}`);
        success++;
      }
    } catch (error: any) {
      console.error(`[${i + 1}/${companies.length}] ❌ ${company.name}: ${error.message}`);
      failed++;
    }

    // Small delay to avoid rate limits
    if (i < companies.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  console.log("\n📊 Scattering Summary:");
  console.log(`   ✅ Successfully updated: ${success}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log("\n✨ Done!\n");
}

// Run scattering
scatterDates().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

