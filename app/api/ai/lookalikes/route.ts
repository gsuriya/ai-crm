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
    const mockCompanies = [
      {
        id: "1",
        name: "Company A",
        reason: "Shared GTM strategy",
        similarity: 85,
      },
      {
        id: "2",
        name: "Company B",
        reason: "Same buyer persona",
        similarity: 78,
      },
      {
        id: "3",
        name: "Company C",
        reason: "Similar market size",
        similarity: 72,
      },
    ];

    return NextResponse.json({ companies: mockCompanies });
  } catch (error: any) {
    console.error("Error fetching lookalikes:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch lookalikes" },
      { status: 500 }
    );
  }
}


