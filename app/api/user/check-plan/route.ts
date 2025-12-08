import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { checkPlanLimits, pauseAllCadencesForUser, resumePlanExpiredCadences } from "@/lib/services/plan-limits";

export async function GET() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Check plan status
    const planStatus = await checkPlanLimits(supabase, user.id);

    // If plan expired, pause all cadences
    if (planStatus.isExpired) {
      const { paused } = await pauseAllCadencesForUser(supabase, user.id);
      console.log(`[Plan Check] User ${user.id} plan expired, paused ${paused} cadences`);
      
      return NextResponse.json({
        plan: 'free',
        isExpired: true,
        cadencesPaused: paused,
        peopleAdded: planStatus.peopleAdded,
        limit: planStatus.limit,
        canAddMore: planStatus.canAddMore,
        message: "Your plan has expired. Active cadences have been paused."
      });
    }

    return NextResponse.json({
      plan: planStatus.plan,
      isExpired: false,
      peopleAdded: planStatus.peopleAdded,
      limit: planStatus.limit,
      canAddMore: planStatus.canAddMore
    });
  } catch (error: any) {
    console.error("[Plan Check] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
