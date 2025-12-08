import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const { executionId, newScheduledFor } = await request.json();

    if (!executionId || !newScheduledFor) {
      return NextResponse.json(
        { error: "executionId and newScheduledFor are required" },
        { status: 400 }
      );
    }

    // Get the current execution
    const { data: execution, error: fetchError } = await supabase
      .from("cadence_executions")
      .select("*")
      .eq("id", executionId)
      .single();

    if (fetchError || !execution) {
      return NextResponse.json(
        { error: "Execution not found" },
        { status: 404 }
      );
    }

    if (execution.status !== "active") {
      return NextResponse.json(
        { error: "Can only adjust wait time for active executions" },
        { status: 400 }
      );
    }

    // Update the scheduled_for time
    const { error: updateError } = await supabase
      .from("cadence_executions")
      .update({
        scheduled_for: newScheduledFor,
        metadata: {
          ...execution.metadata,
          waitAdjusted: {
            adjustedAt: new Date().toISOString(),
            newScheduledFor,
          },
        },
      })
      .eq("id", executionId);

    if (updateError) {
      console.error("Error adjusting wait:", updateError);
      return NextResponse.json(
        { error: "Failed to adjust wait time" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Wait time adjusted",
      newScheduledFor,
    });
  } catch (error: any) {
    console.error("Error in adjust-wait:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
