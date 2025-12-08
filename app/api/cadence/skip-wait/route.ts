import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const { executionId } = await request.json();

    if (!executionId) {
      return NextResponse.json({ error: "Execution ID required" }, { status: 400 });
    }

    // Get the execution
    const { data: execution, error: execError } = await supabase
      .from("cadence_executions")
      .select("*")
      .eq("id", executionId)
      .single();

    if (execError || !execution) {
      return NextResponse.json({ error: "Execution not found" }, { status: 404 });
    }

    if (execution.status !== "active") {
      return NextResponse.json({ error: "Can only skip wait on active cadences" }, { status: 400 });
    }

    // Check if we're actually in a wait period (scheduled_for is in the future)
    const scheduledFor = execution.scheduled_for ? new Date(execution.scheduled_for).getTime() : 0;
    const now = Date.now();
    
    if (scheduledFor <= now) {
      return NextResponse.json({ error: "Not currently waiting - execution is ready to proceed" }, { status: 400 });
    }

    // Find the delay block that leads to the current block
    const blocks = execution.metadata?.blocks || [];
    const delayBlock = blocks.find((b: any) => 
      b.type === "delay" && 
      b.connections && 
      b.connections.includes(execution.current_block_id)
    );

    // Update scheduled_for to now to trigger immediate execution
    const { error: updateError } = await supabase
      .from("cadence_executions")
      .update({
        scheduled_for: new Date().toISOString(), // Execute immediately
        metadata: {
          ...execution.metadata,
          skippedWait: {
            blockId: delayBlock?.id || "unknown",
            originalScheduledFor: execution.scheduled_for,
            skippedAt: new Date().toISOString(),
          },
        },
      })
      .eq("id", executionId);

    if (updateError) {
      console.error("[Skip Wait] Update error:", updateError);
      return NextResponse.json({ error: "Failed to skip wait" }, { status: 500 });
    }

    console.log("[Skip Wait] Skipped wait for execution " + executionId + ", next block: " + execution.current_block_id);

    return NextResponse.json({ 
      success: true, 
      message: "Wait skipped - next step scheduled immediately",
      nextBlockId: execution.current_block_id
    });
  } catch (error: any) {
    console.error("[Skip Wait] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
