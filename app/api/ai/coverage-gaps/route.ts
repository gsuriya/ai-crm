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
    const mockGaps = [
      {
        id: "1",
        type: "missing-contact",
        title: "Missing CTO contact",
        description: "CTO mentioned in email but not in contacts",
        suggestion: "Add John Doe (john@company.com) as CTO",
        confidence: 85,
      },
      {
        id: "2",
        type: "domain-mismatch",
        title: "Domain mismatch detected",
        description: "Email from company.com but contact uses company.io",
        suggestion: "Verify and update domain mapping",
        confidence: 70,
      },
    ];

    return NextResponse.json({ gaps: mockGaps });
  } catch (error: any) {
    console.error("Error fetching coverage gaps:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch coverage gaps" },
      { status: 500 }
    );
  }
}


