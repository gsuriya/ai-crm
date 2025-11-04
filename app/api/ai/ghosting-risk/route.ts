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
    const mockFlags = [
      {
        id: "1",
        type: "ghosting",
        title: "Ghosting risk",
        description: "No response to last 3 emails over 21 days",
        severity: "high",
        mitigation: "Consider re-engagement sequence or direct call",
      },
      {
        id: "2",
        type: "data-staleness",
        title: "Data staleness",
        description: "Financial data last updated 6 months ago",
        severity: "medium",
        mitigation: "Request updated metrics or enrich from public sources",
      },
    ];

    return NextResponse.json({ flags: mockFlags });
  } catch (error: any) {
    console.error("Error fetching ghosting risk:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch ghosting risk" },
      { status: 500 }
    );
  }
}


