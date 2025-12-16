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
    const mockActions = [
      {
        id: "1",
        title: "CEO replied 12d ago — draft follow-up",
        description: "Last email was sent 12 days ago. Consider sending a follow-up to maintain engagement.",
        priority: "high",
        actionType: "email",
      },
      {
        id: "2",
        title: "No cadence on CTO — assign?",
        description: "CTO contact has no active cadence. Consider adding them to a warm outreach sequence.",
        priority: "medium",
        actionType: "task",
      },
    ];

    return NextResponse.json({ actions: mockActions });
  } catch (error: any) {
    console.error("Error fetching next actions:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch next actions" },
      { status: 500 }
    );
  }
}


