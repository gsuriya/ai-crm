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
    const mockExplanation = "Strong fit: SaaS company targeting SMBs matches our ICP. Geographic expansion potential in Europe. Recommend $2M check size. B2B model aligns with our thesis.";

    return NextResponse.json({ explanation: mockExplanation });
  } catch (error: any) {
    console.error("Error fetching thesis fit:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch thesis fit" },
      { status: 500 }
    );
  }
}


