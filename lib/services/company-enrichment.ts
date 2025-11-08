/**
 * Company Enrichment Service
 * 
 * Supports multiple data providers:
 * 1. Clearbit (most accessible, good for basic firmographics)
 * 2. Crunchbase API (best for financials, requires enterprise access)
 * 3. PitchBook API (comprehensive financials, requires enterprise access)
 * 
 * Note: ARR/MRR are often proprietary and may not be available via APIs
 * for private companies. These metrics are typically only available through:
 * - Direct company disclosure
 * - PitchBook/Crunchbase (if company shared data)
 * - Manual research
 */

import { SupabaseClient } from "@supabase/supabase-js";

export interface EnrichedCompanyData {
  // Basic firmographics
  website?: string;
  description?: string;
  industry?: string;
  employee_count?: number;
  headquarters?: string;
  founding_date?: string;
  linkedin_url?: string;
  twitter_handle?: string;
  
  // Financials (may not always be available)
  arr?: number;
  mrr?: number;
  revenue?: number;
  funding_amount?: number;
  funding_round?: string;
  last_funding_date?: string;
  valuation?: number;
  
  // Funding rounds
  funding_rounds?: Array<{
    round_type: string;
    amount: number;
    date: string;
    lead_investor?: string;
    investors?: string[];
  }>;
  
  // Metadata
  data_source?: string;
  enrichment_date?: string;
  confidence_score?: number;
}

/**
 * Clearbit Enrichment API
 * 
 * Pricing: Free tier available, then $99+/month
 * Coverage: Good for basic firmographics, limited financials
 * Best for: Company name, website, description, employee count, location
 */
export async function enrichWithClearbit(
  companyName: string,
  domain?: string
): Promise<EnrichedCompanyData | null> {
  const apiKey = process.env.CLEARBIT_API_KEY;
  if (!apiKey) {
    console.warn("CLEARBIT_API_KEY not set");
    return null;
  }

  try {
    // Clearbit can search by domain or company name
    const searchParam = domain || companyName;
    const url = domain
      ? `https://company.clearbit.com/v2/companies/find?domain=${encodeURIComponent(domain)}`
      : `https://company.clearbit.com/v2/companies/search?query=${encodeURIComponent(companyName)}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null; // Company not found
      }
      throw new Error(`Clearbit API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Handle array response from search
    const company = Array.isArray(data) ? data[0] : data;
    if (!company) return null;

    return {
      website: company.domain ? `https://${company.domain}` : undefined,
      description: company.description,
      industry: company.category?.industry,
      employee_count: company.metrics?.employees,
      headquarters: company.geo?.city
        ? `${company.geo.city}, ${company.geo.state || company.geo.country}`
        : company.geo?.country,
      founding_date: company.foundedYear
        ? `${company.foundedYear}-01-01`
        : undefined,
      linkedin_url: company.linkedin?.handle
        ? `https://linkedin.com/company/${company.linkedin.handle}`
        : undefined,
      twitter_handle: company.twitter?.handle,
      funding_amount: company.metrics?.raised,
      revenue: company.metrics?.annualRevenue,
      data_source: "clearbit",
      enrichment_date: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Clearbit enrichment error:", error);
    return null;
  }
}

/**
 * Crunchbase API Enrichment
 * 
 * Pricing: Enterprise (contact sales, typically $10k+/year)
 * Coverage: Excellent for financials, funding rounds, ARR (if available)
 * Best for: Funding rounds, financial metrics, investor data
 * 
 * Note: Requires API key from Crunchbase sales team
 */
export async function enrichWithCrunchbase(
  companyName: string,
  domain?: string
): Promise<EnrichedCompanyData | null> {
  const apiKey = process.env.CRUNCHBASE_API_KEY;
  if (!apiKey) {
    console.warn("CRUNCHBASE_API_KEY not set");
    return null;
  }

  try {
    // Crunchbase API endpoint (adjust based on your API package)
    const searchUrl = `https://api.crunchbase.com/v4/searches/organizations`;
    
    const response = await fetch(searchUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-cb-user-key": apiKey,
      },
      body: JSON.stringify({
        query: [
          {
            type: "predicate",
            field_id: "name",
            operator_id: "contains",
            values: [companyName],
          },
        ],
        limit: 1,
      }),
    });

    if (!response.ok) {
      throw new Error(`Crunchbase API error: ${response.status}`);
    }

    const data = await response.json();
    const org = data?.entities?.[0]?.properties;
    if (!org) return null;

    // Extract funding rounds
    const fundingRounds = org.funding_rounds?.map((round: any) => ({
      round_type: round.funding_round_type,
      amount: round.money_raised_usd,
      date: round.announced_on,
      lead_investor: round.lead_investors?.[0]?.name,
      investors: round.investors?.map((inv: any) => inv.name) || [],
    })) || [];

    return {
      website: org.website,
      description: org.short_description,
      industry: org.categories?.[0]?.name,
      employee_count: org.num_employees_enum,
      headquarters: org.location_identifiers?.[0]?.name,
      founding_date: org.founded_on,
      linkedin_url: org.linkedin,
      funding_amount: org.total_funding_usd,
      funding_rounds: fundingRounds,
      valuation: org.last_funding_total_money_raised_usd,
      // Note: ARR/MRR typically not available via Crunchbase API
      data_source: "crunchbase",
      enrichment_date: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Crunchbase enrichment error:", error);
    return null;
  }
}

/**
 * PitchBook API Enrichment
 * 
 * Pricing: Enterprise (contact sales, typically $15k+/year)
 * Coverage: Best for financials, ARR/MRR (if disclosed), detailed metrics
 * Best for: ARR, MRR, EBITDA, retention metrics, detailed financials
 * 
 * Note: Requires API access from PitchBook Direct Data team
 */
export async function enrichWithPitchBook(
  companyName: string,
  domain?: string
): Promise<EnrichedCompanyData | null> {
  const apiKey = process.env.PITCHBOOK_API_KEY;
  if (!apiKey) {
    console.warn("PITCHBOOK_API_KEY not set");
    return null;
  }

  try {
    // PitchBook API endpoint (adjust based on your API version)
    const searchUrl = `https://api.pitchbook.com/v1/companies/search`;
    
    const response = await fetch(searchUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      // Add query params based on PitchBook API docs
    });

    if (!response.ok) {
      throw new Error(`PitchBook API error: ${response.status}`);
    }

    const data = await response.json();
    const company = data?.results?.[0];
    if (!company) return null;

    return {
      website: company.website,
      description: company.description,
      industry: company.industry,
      employee_count: company.employee_count,
      headquarters: company.headquarters,
      founding_date: company.founded_date,
      arr: company.financials?.arr, // May not always be available
      mrr: company.financials?.mrr, // May not always be available
      revenue: company.financials?.revenue,
      funding_amount: company.total_funding,
      valuation: company.valuation,
      funding_rounds: company.funding_rounds?.map((round: any) => ({
        round_type: round.type,
        amount: round.amount,
        date: round.date,
        lead_investor: round.lead_investor,
        investors: round.investors || [],
      })),
      data_source: "pitchbook",
      enrichment_date: new Date().toISOString(),
      confidence_score: company.data_quality_score,
    };
  } catch (error) {
    console.error("PitchBook enrichment error:", error);
    return null;
  }
}

/**
 * Multi-source enrichment strategy
 * 
 * Tries providers in order of accessibility:
 * 1. Clearbit (most accessible)
 * 2. Crunchbase (if available)
 * 3. PitchBook (if available)
 * 
 * Merges results, preferring more detailed sources
 */
export async function enrichCompany(
  companyName: string,
  domain?: string,
  preferredProvider?: "clearbit" | "crunchbase" | "pitchbook"
): Promise<EnrichedCompanyData | null> {
  let result: EnrichedCompanyData | null = null;

  // Use preferred provider if specified
  if (preferredProvider === "clearbit") {
    result = await enrichWithClearbit(companyName, domain);
  } else if (preferredProvider === "crunchbase") {
    result = await enrichWithCrunchbase(companyName, domain);
  } else if (preferredProvider === "pitchbook") {
    result = await enrichWithPitchBook(companyName, domain);
  } else {
    // Try all available providers, merge results
    const [clearbitData, crunchbaseData, pitchbookData] = await Promise.all([
      enrichWithClearbit(companyName, domain),
      enrichWithCrunchbase(companyName, domain),
      enrichWithPitchBook(companyName, domain),
    ]);

    // Merge: prefer PitchBook > Crunchbase > Clearbit for financials
    // But use Clearbit for basic firmographics if others don't have it
    result = {
      ...clearbitData,
      ...crunchbaseData,
      ...pitchbookData,
      // Prefer financials from PitchBook/Crunchbase
      arr: pitchbookData?.arr || crunchbaseData?.arr || clearbitData?.arr,
      mrr: pitchbookData?.mrr,
      revenue: pitchbookData?.revenue || crunchbaseData?.revenue || clearbitData?.revenue,
      funding_rounds: pitchbookData?.funding_rounds || crunchbaseData?.funding_rounds,
      // Prefer basic data from Clearbit if others missing
      website: pitchbookData?.website || crunchbaseData?.website || clearbitData?.website,
      description: pitchbookData?.description || crunchbaseData?.description || clearbitData?.description,
      employee_count: pitchbookData?.employee_count || crunchbaseData?.employee_count || clearbitData?.employee_count,
    };
  }

  return result;
}

/**
 * Save enriched data to database
 */
export async function saveEnrichedData(
  supabase: SupabaseClient,
  companyId: string,
  enrichedData: EnrichedCompanyData
): Promise<void> {
  try {
    // Update companies table
    const companyUpdate: any = {};
    
    if (enrichedData.website) companyUpdate.website = enrichedData.website;
    if (enrichedData.description) companyUpdate.description = enrichedData.description;
    if (enrichedData.industry) companyUpdate.industry = enrichedData.industry;
    if (enrichedData.employee_count) companyUpdate.employee_count = enrichedData.employee_count;
    if (enrichedData.headquarters) companyUpdate.headquarters = enrichedData.headquarters;
    if (enrichedData.founding_date) companyUpdate.founding_date = enrichedData.founding_date;
    if (enrichedData.linkedin_url) companyUpdate.linkedin_url = enrichedData.linkedin_url;
    if (enrichedData.funding_amount) companyUpdate.funding_amount = enrichedData.funding_amount;
    if (enrichedData.funding_round) companyUpdate.funding_round = enrichedData.funding_round;

    if (Object.keys(companyUpdate).length > 0) {
      await supabase
        .from("companies")
        .update(companyUpdate)
        .eq("id", companyId);
    }

    // Save financials if available
    if (enrichedData.arr || enrichedData.revenue) {
      const currentYear = new Date().getFullYear();
      
      // Check if financials already exist for this year
      const { data: existing } = await supabase
        .from("company_financials")
        .select("id")
        .eq("company_id", companyId)
        .eq("year", currentYear)
        .maybeSingle();

      const financialsData: any = {
        company_id: companyId,
        year: currentYear,
      };

      if (enrichedData.arr) financialsData.arr = enrichedData.arr;
      if (enrichedData.revenue) {
        // If we have revenue but not ARR, we could estimate ARR for SaaS companies
        // But better to leave it null if not explicitly ARR
      }

      if (existing) {
        await supabase
          .from("company_financials")
          .update(financialsData)
          .eq("id", existing.id);
      } else {
        await supabase.from("company_financials").insert(financialsData);
      }
    }

    // Save funding rounds if available
    if (enrichedData.funding_rounds && enrichedData.funding_rounds.length > 0) {
      // TODO: Create funding_rounds table or use company_metadata
      // For now, we'll store in company_metadata
      await supabase.from("company_metadata").upsert({
        company_id: companyId,
        key: "funding_rounds",
        value_json: enrichedData.funding_rounds,
      });
    }

    // Store enrichment metadata
    await supabase.from("company_metadata").upsert({
      company_id: companyId,
      key: "enrichment_metadata",
      value_json: {
        data_source: enrichedData.data_source,
        enrichment_date: enrichedData.enrichment_date,
        confidence_score: enrichedData.confidence_score,
      },
    });
  } catch (error) {
    console.error("Error saving enriched data:", error);
    throw error;
  }
}

