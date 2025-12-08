import { SupabaseClient } from '@supabase/supabase-js';

export interface PlanStatus {
  plan: 'free' | 'paid';
  peopleAdded: number;
  limit: number;
  canAddMore: boolean;
  isExpired: boolean;
}

const FREE_PLAN_LIMIT = 5;

/**
 * Check user's plan status and limits
 */
export async function checkPlanLimits(
  supabase: SupabaseClient,
  userId: string
): Promise<PlanStatus> {
  // Get user subscription
  const { data: subscription } = await supabase
    .from('user_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .single();

  // No subscription = free plan
  if (!subscription) {
    return {
      plan: 'free',
      peopleAdded: 0,
      limit: FREE_PLAN_LIMIT,
      canAddMore: true,
      isExpired: false,
    };
  }

  const isPaid = subscription.plan_type === 'paid' && subscription.status === 'active';
  const peopleAdded = subscription.people_added_count || 0;

  // Check if paid plan is expired
  const isExpired = isPaid && subscription.current_period_end && 
    new Date(subscription.current_period_end) < new Date();

  if (isPaid && !isExpired) {
    return {
      plan: 'paid',
      peopleAdded,
      limit: Infinity,
      canAddMore: true,
      isExpired: false,
    };
  }

  // Free plan or expired paid plan
  return {
    plan: 'free',
    peopleAdded,
    limit: FREE_PLAN_LIMIT,
    canAddMore: peopleAdded < FREE_PLAN_LIMIT,
    isExpired,
  };
}

/**
 * Increment people_added_count when adding someone to a cadence
 */
export async function incrementPeopleAdded(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  // First check if user has a subscription record
  const { data: existing } = await supabase
    .from('user_subscriptions')
    .select('id, people_added_count')
    .eq('user_id', userId)
    .single();

  if (existing) {
    // Update existing record
    const { error } = await supabase
      .from('user_subscriptions')
      .update({ 
        people_added_count: (existing.people_added_count || 0) + 1,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    return !error;
  } else {
    // Create new record for free user
    const { error } = await supabase
      .from('user_subscriptions')
      .insert({
        user_id: userId,
        plan_type: 'free',
        status: 'active',
        people_added_count: 1,
      });

    return !error;
  }
}

/**
 * Pause all active cadences for a user (when plan expires)
 */
export async function pauseAllCadencesForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<{ paused: number }> {
  // Get all active cadence executions for this user
  const { data: executions } = await supabase
    .from('cadence_executions')
    .select('id, company_cadence_id, metadata')
    .eq('status', 'active');

  if (!executions || executions.length === 0) {
    return { paused: 0 };
  }

  // Filter to only this user's executions
  const userExecutions = executions.filter(
    (e: any) => e.metadata?.user_id === userId
  );

  let pausedCount = 0;

  for (const exec of userExecutions) {
    // Update execution status
    await supabase
      .from('cadence_executions')
      .update({
        status: 'paused',
        metadata: {
          ...exec.metadata,
          paused_reason: 'plan_expired',
          paused_at: new Date().toISOString(),
        },
      })
      .eq('id', exec.id);

    // Update company_cadence status
    await supabase
      .from('company_cadences')
      .update({ status: 'paused' })
      .eq('id', exec.company_cadence_id);

    pausedCount++;
  }

  return { paused: pausedCount };
}

/**
 * Resume cadences that were paused due to plan expiration
 */
export async function resumePlanExpiredCadences(
  supabase: SupabaseClient,
  userId: string
): Promise<{ resumed: number }> {
  // Get all paused cadence executions for this user that were paused due to plan expiration
  const { data: executions } = await supabase
    .from('cadence_executions')
    .select('id, company_cadence_id, metadata')
    .eq('status', 'paused');

  if (!executions || executions.length === 0) {
    return { resumed: 0 };
  }

  // Filter to this user's executions paused due to plan expiration
  const planExpiredExecutions = executions.filter(
    (e: any) => e.metadata?.user_id === userId && e.metadata?.paused_reason === 'plan_expired'
  );

  let resumedCount = 0;

  for (const exec of planExpiredExecutions) {
    const newMetadata = { ...exec.metadata };
    delete newMetadata.paused_reason;
    delete newMetadata.paused_at;

    // Update execution status
    await supabase
      .from('cadence_executions')
      .update({
        status: 'active',
        metadata: newMetadata,
        scheduled_for: new Date().toISOString(), // Resume immediately
      })
      .eq('id', exec.id);

    // Update company_cadence status
    await supabase
      .from('company_cadences')
      .update({ status: 'active' })
      .eq('id', exec.company_cadence_id);

    resumedCount++;
  }

  return { resumed: resumedCount };
}
