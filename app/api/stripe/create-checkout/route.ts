import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  
});

export async function POST(request: NextRequest) {
  try {
    console.log('[Stripe] Starting checkout creation');
    
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error('[Stripe] Failed to get user:', userError);
      return NextResponse.json({ error: 'Not authenticated. Please sign in.' }, { status: 401 });
    }

    console.log('[Stripe] User authenticated:', user.email);

    const { data: existingSub } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .single();

    let customerId = existingSub?.stripe_customer_id;

    if (!customerId) {
      console.log('[Stripe] Creating new Stripe customer');
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          supabase_user_id: user.id,
        },
      });
      customerId = customer.id;
      console.log('[Stripe] Created customer:', customerId);
    }

    console.log('[Stripe] Creating checkout session');
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      ui_mode: 'embedded',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Cheddar - Unlimited Plan',
              description: 'Unlimited email outreach, lookups, and cadences',
            },
            unit_amount: 2000,
            recurring: {
              interval: 'month',
            },
          },
          quantity: 1,
        },
      ],
      mode: 'subscription',
      allow_promotion_codes: true,
      payment_method_collection: 'if_required',
      return_url: `${process.env.NEXT_PUBLIC_SITE_URL}/upgrade/success?session_id={CHECKOUT_SESSION_ID}`,
      metadata: {
        user_id: user.id,
      },
    });

    console.log('[Stripe] Checkout session created:', session.id);
    
    return NextResponse.json({ clientSecret: session.client_secret });
  } catch (error: any) {
    console.error('[Stripe] Error creating checkout session:', error);
    console.error('[Stripe] Error details:', error.message);
    return NextResponse.json(
      { error: error.message || 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
