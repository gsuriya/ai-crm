import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const companyId = searchParams.get("companyId");

    if (!companyId) {
      return NextResponse.json(
        { error: "companyId is required" },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // TODO: Replace with real AI logic
    // Mock data for now
    const mockInsights = [
      {
        id: "1",
        type: "one-minute-brief",
        title: "One-Minute Brief",
        description: "Quick summary of company status and key metrics",
        summary: "SaaS company with $10M ARR, 120% NRR, strong growth trajectory. Last touch: 12 days ago.",
        actionable: true,
        confidence: 95,
      },
      {
        id: "2",
        type: "warm-intros-map",
        title: "Warm Intros Map",
        description: "Map of warm introduction opportunities",
        summary: "3 warm intro opportunities: John Doe (LinkedIn), Jane Smith (Email), Bob Johnson (Mutual connection)",
        actionable: true,
        confidence: 85,
      },
      {
        id: "3",
        type: "thesis-fit-score",
        title: "Thesis Fit Score",
        description: "How well the company fits your investment thesis",
        summary: "Strong fit (85%): SaaS, SMB focus, B2B model aligns with portfolio. Geographic expansion potential.",
        actionable: true,
        confidence: 90,
      },
      {
        id: "4",
        type: "lookalike-graph",
        title: "Lookalike Graph",
        description: "Similar companies in your portfolio",
        summary: "Similar to 3 portfolio companies: Company A (85% match), Company B (78% match), Company C (72% match)",
        actionable: true,
        confidence: 80,
      },
      {
        id: "5",
        type: "ghosting-risk",
        title: "Ghosting Risk",
        description: "Risk of company going silent",
        summary: "Medium risk: No response to last 2 emails over 14 days. Consider re-engagement sequence.",
        actionable: true,
        confidence: 75,
      },
      {
        id: "6",
        type: "what-changed",
        title: "What Changed?",
        description: "Recent changes in company data and activity",
        summary: "Updated: ARR increased 15%, headcount grew 20%, new round announced. Last updated: 2 days ago.",
        actionable: true,
        confidence: 95,
      },
      {
        id: "7",
        type: "diligence-accelerator",
        title: "Diligence Accelerator",
        description: "AI-powered diligence checklist and recommendations",
        summary: "5 completed, 3 pending, 2 recommended: Customer references, financial audit, market analysis",
        actionable: true,
        confidence: 90,
      },
      {
        id: "8",
        type: "valuation-sanity",
        title: "Valuation Sanity Check",
        description: "Compare valuation to benchmarks and portfolio",
        summary: "Valuation: $50M. Benchmark: $45M-$55M. Portfolio average: $48M. Within range.",
        actionable: true,
        confidence: 85,
      },
    ];

    return NextResponse.json({ insights: mockInsights });
  } catch (error: any) {
    console.error("Error fetching insights:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch insights" },
      { status: 500 }
    );
  }
}


