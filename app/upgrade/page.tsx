"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { loadStripe } from "@stripe/stripe-js";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export default function UpgradePage() {
  const router = useRouter();
  const [showCheckout, setShowCheckout] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const fetchClientSecret = async () => {
    const response = await fetch('/api/stripe/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error('Failed to create checkout session');
    }

    const { clientSecret } = await response.json();
    return clientSecret;
  };

  const handleUpgrade = async () => {
    try {
      setShowCheckout(true);
      const secret = await fetchClientSecret();
      setClientSecret(secret);
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to start checkout. Please try again.');
      setShowCheckout(false);
    }
  };

  if (showCheckout && clientSecret) {
    return (
      <div className="min-h-screen bg-white py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => {
              setShowCheckout(false);
              setClientSecret(null);
            }}
            className="flex items-center gap-2 text-gray-600 hover:text-black mb-8 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <EmbeddedCheckoutProvider
            stripe={stripePromise}
            options={{ clientSecret }}
          >
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white py-12 px-4">
      <div className="max-w-5xl mx-auto">
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-2 text-gray-600 hover:text-black mb-8 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </button>

        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-black mb-2">
            Upgrade to Unlimited
          </h1>
          <p className="text-gray-600">
            Scale your outreach without limits
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {/* Free Plan */}
          <div className="bg-white rounded-xl border-2 border-gray-200 p-8">
            <div className="mb-6">
              <h3 className="text-xl font-bold text-black mb-1">Free</h3>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-4xl font-bold text-black">$0</span>
                <span className="text-gray-500">/month</span>
              </div>
              <p className="text-sm text-gray-600">Perfect for testing</p>
            </div>

            <ul className="space-y-3 mb-8">
              <li className="flex items-start gap-2.5">
                <Check className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-gray-700">5 cadence adds total</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-gray-700">Basic email sequences</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-gray-700">Email finder (Hunter.io)</span>
              </li>
            </ul>

            <button
              disabled
              className="w-full py-2.5 px-4 rounded-lg bg-gray-100 text-gray-400 font-medium text-sm cursor-not-allowed"
            >
              Current Plan
            </button>
          </div>

          {/* Paid Plan */}
          <div className="bg-black rounded-xl border-2 border-black p-8 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white px-3 py-1 rounded-full border border-gray-200">
              <span className="text-xs font-semibold text-black">RECOMMENDED</span>
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-bold text-white mb-1">Pro</h3>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-4xl font-bold text-white">$30</span>
                <span className="text-gray-400">/month</span>
              </div>
              <p className="text-sm text-gray-400">Everything you need to scale</p>
            </div>

            <ul className="space-y-3 mb-8">
              <li className="flex items-start gap-2.5">
                <Check className="h-4 w-4 text-white flex-shrink-0 mt-0.5" />
                <span className="text-sm text-white font-medium">Unlimited cadence adds</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check className="h-4 w-4 text-white flex-shrink-0 mt-0.5" />
                <span className="text-sm text-white font-medium">Unlimited email sequences</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check className="h-4 w-4 text-white flex-shrink-0 mt-0.5" />
                <span className="text-sm text-gray-300">Priority email delivery</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check className="h-4 w-4 text-white flex-shrink-0 mt-0.5" />
                <span className="text-sm text-gray-300">Advanced analytics</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check className="h-4 w-4 text-white flex-shrink-0 mt-0.5" />
                <span className="text-sm text-gray-300">Priority support</span>
              </li>
            </ul>

            <button
              onClick={handleUpgrade}
              className="w-full py-3 px-4 rounded-lg bg-white text-black font-semibold text-sm hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
            >
              Upgrade Now
            </button>

            <p className="text-center text-gray-400 text-xs mt-3">
              Cancel anytime
            </p>
          </div>
        </div>

        {/* Simple FAQ */}
        <div className="mt-16 max-w-2xl mx-auto">
          <h2 className="text-xl font-bold text-black mb-6 text-center">
            Questions?
          </h2>
          
          <div className="space-y-4">
            <div className="border border-gray-200 rounded-lg p-5">
              <h3 className="font-semibold text-black text-sm mb-2">
                How does email caching work?
              </h3>
              <p className="text-sm text-gray-600">
                We save company email formats so we don&apos;t need expensive lookups every time. This keeps costs low and lookups instant.
              </p>
            </div>

            <div className="border border-gray-200 rounded-lg p-5">
              <h3 className="font-semibold text-black text-sm mb-2">
                Can I cancel anytime?
              </h3>
              <p className="text-sm text-gray-600">
                Yes. Cancel from your account settings. You&apos;ll keep access until the end of your billing period.
              </p>
            </div>

            <div className="border border-gray-200 rounded-lg p-5">
              <h3 className="font-semibold text-black text-sm mb-2">
                What happens to my cadences if I cancel?
              </h3>
              <p className="text-sm text-gray-600">
                Your active cadences will be paused (not deleted) when your subscription ends. When you upgrade again, you can resume them right from where they left off.
              </p>
            </div>

            <div className="border border-gray-200 rounded-lg p-5">
              <h3 className="font-semibold text-black text-sm mb-2">
                Is there really no limit?
              </h3>
              <p className="text-sm text-gray-600">
                Correct. Add as many people to cadences as you want with no limits.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
