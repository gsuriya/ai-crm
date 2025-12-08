import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabase } from '@/lib/supabase';
import { pauseAllCadencesForUser, resumePlanExpiredCadences } from '@/lib/services/plan-limits';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature')!;

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    console.log('[Stripe Webhook] Event type:', event.type);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.user_id;

        if (!userId) {
          console.error('[Stripe Webhook] No user_id in metadata');
          break;
        }

        const subscription = await stripe.subscriptions.retrieve(
          session.subscription as string
        );

        // Check if user had a previous subscription (re-subscribing)
        const { data: existingSub } = await supabase
          .from('user_subscriptions')
          .select('people_added_count')
          .eq('user_id', userId)
          .single();

        await supabase
          .from('user_subscriptions')
          .upsert({
            user_id: userId,
            plan_type: 'paid',
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: subscription.id,
            stripe_price_id: subscription.items.data[0].price.id,
            status: 'active',
            current_period_start: new Date((subscription as any).current_period_start * 1000).toISOString(),
            current_period_end: new Date((subscription as any).current_period_end * 1000).toISOString(),
            cancel_at_period_end: false,
            people_added_count: existingSub?.people_added_count || 0,
          }, {
            onConflict: 'user_id'
          });

        // Resume any cadences that were paused due to plan expiration
        const { resumed } = await resumePlanExpiredCadences(supabase, userId);
        console.log(`[Stripe Webhook] Subscription activated for user: ${userId}, resumed ${resumed} cadences`);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        
        await supabase
          .from('user_subscriptions')
          .update({
            status: subscription.status,
            current_period_start: new Date((subscription as any).current_period_start * 1000).toISOString(),
            current_period_end: new Date((subscription as any).current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end,
          })
          .eq('stripe_subscription_id', subscription.id);

        console.log('[Stripe Webhook] Subscription updated:', subscription.id, 'cancel_at_period_end:', subscription.cancel_at_period_end);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        
        // Get user_id from our database
        const { data: userSub } = await supabase
          .from('user_subscriptions')
          .select('user_id')
          .eq('stripe_subscription_id', subscription.id)
          .single();

        // Update subscription status
        await supabase
          .from('user_subscriptions')
          .update({
            plan_type: 'free',
            status: 'cancelled',
            cancel_at_period_end: false,
          })
          .eq('stripe_subscription_id', subscription.id);

        // Pause all active cadences for this user
        if (userSub?.user_id) {
          const { paused } = await pauseAllCadencesForUser(supabase, userSub.user_id);
          console.log(`[Stripe Webhook] Subscription cancelled for user: ${userSub.user_id}, paused ${paused} cadences`);
        }

        console.log('[Stripe Webhook] Subscription cancelled:', subscription.id);
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('[Stripe Webhook] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Webhook handler failed' },
      { status: 500 }
    );
  }
}
