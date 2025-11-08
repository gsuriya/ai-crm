import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { enrichCompany, saveEnrichedData } from "@/lib/services/company-enrichment";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const companyId = params.id;
    const body = await request.json();
    const { provider, domain } = body;

    if (!companyId) {
      return NextResponse.json(
        { error: "Company ID is required" },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch company details
    const { data: company, error: fetchError } = await supabase
      .from("companies")
      .select("name, website, domain")
      .eq("id", companyId)
      .single();

    if (fetchError || !company) {
      return NextResponse.json(
        { error: "Company not found" },
        { status: 404 }
      );
    }

    // Extract domain from website if available
    const companyDomain =
      domain ||
      (company.website
        ? new URL(company.website).hostname.replace("www.", "")
        : undefined);

    // Enrich company data
    const enrichedData = await enrichCompany(
      company.name,
      companyDomain,
      provider
    );

    if (!enrichedData) {
      return NextResponse.json(
        { error: "Could not enrich company data. No data sources available or company not found." },
        { status: 404 }
      );
    }

    // Save enriched data to database
    await saveEnrichedData(supabase, companyId, enrichedData);

    return NextResponse.json({
      success: true,
      data: enrichedData,
      message: `Company enriched using ${enrichedData.data_source || "unknown"} data source`,
    });
  } catch (error: any) {
    console.error("Enrichment error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to enrich company" },
      { status: 500 }
    );
  }
}

