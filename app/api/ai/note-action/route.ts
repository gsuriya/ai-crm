import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const companyId = searchParams.get("companyId");
    const action = searchParams.get("action");

    if (!companyId || !action) {
      return NextResponse.json(
        { error: "companyId and action are required" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { content } = body;

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
    let result = content;

    switch (action) {
      case "extract-actions":
        result = content + "\n\n## Action Items (Extracted)\n- Action item 1\n- Action item 2";
        break;
      case "summarize":
        result = "Summary: " + content.substring(0, 200) + "...";
        break;
      case "highlight":
        result = content + "\n\n## Key Points\n- Point 1\n- Point 2";
        break;
      case "improve":
        result = content; // Improved version
        break;
      default:
        result = content;
    }

    return NextResponse.json({ result });
  } catch (error: any) {
    console.error("Error performing note action:", error);
    return NextResponse.json(
      { error: error.message || "Failed to perform action" },
      { status: 500 }
    );
  }
}


