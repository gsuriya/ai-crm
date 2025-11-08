/**
 * Backfill Company Logos Script
 * 
 * Fetches logos for all companies that don't have a logo_url yet.
 * Uses Clearbit's logo API based on company domain/website.
 * 
 * Usage:
 *   tsx scripts/backfill-company-logos.ts
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
 * Get domain from website URL
 */
function getDomain(website?: string | null): string | null {
  if (website) {
    try {
      const url = new URL(website.startsWith('http') ? website : `https://${website}`);
      return url.hostname.replace('www.', '');
    } catch {
      return null;
    }
  }
  
  return null;
}

/**
 * Get Clearbit logo URL from domain
 */
function getLogoUrl(domain: string): string {
  return `https://logo.clearbit.com/${domain}`;
}

/**
 * Backfill logos for companies
 */
async function backfillLogos() {
  console.log("\n🚀 Starting company logo backfill...\n");

  // Fetch companies without logos
  const { data: companies, error } = await supabase
    .from("companies")
    .select("id, name, website, logo_url")
    .is("logo_url", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("❌ Error fetching companies:", error);
    process.exit(1);
  }

  if (!companies || companies.length === 0) {
    console.log("ℹ️  All companies already have logos");
    return;
  }

  console.log(`📊 Found ${companies.length} companies without logos\n`);

  let success = 0;
  let skipped = 0;

  for (let i = 0; i < companies.length; i++) {
    const company = companies[i];
    const domain = getDomain(company.website);

    if (!domain) {
      console.log(`[${i + 1}/${companies.length}] ⚠️  ${company.name}: No domain/website found`);
      skipped++;
      continue;
    }

    const logoUrl = getLogoUrl(domain);

    try {
      const { error: updateError } = await supabase
        .from("companies")
        .update({ logo_url: logoUrl })
        .eq("id", company.id);

      if (updateError) {
        console.error(`[${i + 1}/${companies.length}] ❌ ${company.name}: ${updateError.message}`);
      } else {
        console.log(`[${i + 1}/${companies.length}] ✅ ${company.name}: ${logoUrl}`);
        success++;
      }
    } catch (error: any) {
      console.error(`[${i + 1}/${companies.length}] ❌ ${company.name}: ${error.message}`);
    }

    // Small delay to avoid rate limits
    if (i < companies.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  console.log("\n📊 Backfill Summary:");
  console.log(`   ✅ Successfully added logos: ${success}`);
  console.log(`   ⚠️  Skipped (no domain): ${skipped}`);
  console.log(`   ❌ Failed: ${companies.length - success - skipped}`);
  console.log("\n✨ Done!\n");
}

// Run backfill
backfillLogos().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

