import { NextResponse } from "next/server";
import { checkAndPauseCadencesWithReplies, checkCompletedCadencesForReplies } from "@/lib/services/email-reply-detector";

/**
 * Check for email replies on all cadences (active and completed)
 * Call this endpoint periodically to detect late replies
 */
export async function POST() {
  try {
    console.log('[Check Replies] Starting reply check...');
    
    // Check active cadences
    const activeResults = await checkAndPauseCadencesWithReplies();
    console.log(`[Check Replies] Active cadences: checked ${activeResults.checked}, paused ${activeResults.paused}`);
    
    // Check completed cadences for late replies
    const completedResults = await checkCompletedCadencesForReplies();
    console.log(`[Check Replies] Completed cadences: checked ${completedResults.checked}, responded ${completedResults.responded}`);
    
    return NextResponse.json({
      success: true,
      results: {
        active: {
          checked: activeResults.checked,
          paused: activeResults.paused,
        },
        completed: {
          checked: completedResults.checked,
          responded: completedResults.responded,
        },
      },
    });
  } catch (error: any) {
    console.error('[Check Replies] Error:', error.message);
    return NextResponse.json(
      { error: error.message || 'Failed to check replies' },
      { status: 500 }
    );
  }
}

// Also support GET for easy testing
export async function GET() {
  return POST();
}
