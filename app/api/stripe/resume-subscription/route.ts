import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST() {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get user's subscription
    const { data: subscription } = await supabase
      .from('user_subscriptions')
      .select('stripe_subscription_id, cancel_at_period_end')
      .eq('user_id', user.id)
      .single();

    if (!subscription?.stripe_subscription_id) {
      return NextResponse.json({ error: 'No subscription found' }, { status: 400 });
    }

    if (!subscription.cancel_at_period_end) {
      return NextResponse.json({ error: 'Subscription is not scheduled to cancel' }, { status: 400 });
    }

    // Resume the subscription by removing cancel_at_period_end
    await stripe.subscriptions.update(subscription.stripe_subscription_id, {
      cancel_at_period_end: false,
    });

    // Update database
    await supabase
      .from('user_subscriptions')
      .update({ cancel_at_period_end: false })
      .eq('user_id', user.id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error resuming subscription:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
