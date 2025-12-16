import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export const dynamic = 'force-dynamic';

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
    const mockAnomalies = [
      {
        id: "1",
        type: "warning",
        title: "Low Gross Retention",
        description: "Gross retention is below industry benchmark (90%)",
        metric: "Gross Retention",
        value: 85,
        benchmark: 90,
        recommendation: "Investigate churn reasons and improve retention strategies",
      },
    ];

    return NextResponse.json({ anomalies: mockAnomalies });
  } catch (error: any) {
    console.error("Error fetching anomalies:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch anomalies" },
      { status: 500 }
    );
  }
}


