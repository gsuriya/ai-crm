"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { CreditCard, Zap, CheckCircle, XCircle, Calendar, Users, Mail, ArrowLeft, Loader2, ExternalLink } from "lucide-react";

interface SubscriptionData {
  planType: 'free' | 'paid';
  status: string;
  peopleAddedCount: number;
  cancelAtPeriodEnd: boolean;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [cancellingPlan, setCancellingPlan] = useState(false);
  const [resumingPlan, setResumingPlan] = useState(false);
  const [managingBilling, setManagingBilling] = useState(false);

  const FREE_LIMIT = 5;

  useEffect(() => {
    fetchSubscription();
  }, []);

  const fetchSubscription = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth/signin');
        return;
      }

      setUserEmail(user.email || null);

      const { data: sub } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (sub) {
        setSubscription({
          planType: sub.plan_type === 'paid' && sub.status === 'active' ? 'paid' : 'free',
          status: sub.status || 'active',
          peopleAddedCount: sub.people_added_count || 0,
          cancelAtPeriodEnd: sub.cancel_at_period_end || false,
          currentPeriodStart: sub.current_period_start,
          currentPeriodEnd: sub.current_period_end,
          stripeCustomerId: sub.stripe_customer_id,
          stripeSubscriptionId: sub.stripe_subscription_id,
        });
      } else {
        // Create default free subscription
        setSubscription({
          planType: 'free',
          status: 'active',
          peopleAddedCount: 0,
          cancelAtPeriodEnd: false,
          currentPeriodStart: null,
          currentPeriodEnd: null,
          stripeCustomerId: null,
          stripeSubscriptionId: null,
        });
      }
    } catch (error) {
      console.error('Error fetching subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    const endDate = subscription?.currentPeriodEnd 
      ? formatDate(subscription.currentPeriodEnd)
      : 'end of billing period';
    
    if (!confirm(`Are you sure you want to cancel?\n\nYou'll keep Pro access until ${endDate}.\nYour active cadences will be paused after that date.`)) {
      return;
    }

    setCancellingPlan(true);
    try {
      const response = await fetch('/api/stripe/cancel-subscription', {
        method: 'POST',
      });
      const data = await response.json();
      
      if (!response.ok) throw new Error(data.error || 'Failed to cancel');
      
      alert(`Your subscription will cancel on ${endDate}. You'll keep all Pro features until then.`);
      await fetchSubscription();
    } catch (error: any) {
      console.error('Error cancelling:', error);
      alert('Failed to cancel: ' + error.message);
    } finally {
      setCancellingPlan(false);
    }
  };

  const handleResumeSubscription = async () => {
    setResumingPlan(true);
    try {
      const response = await fetch('/api/stripe/resume-subscription', {
        method: 'POST',
      });
      const data = await response.json();
      
      if (!response.ok) throw new Error(data.error || 'Failed to resume');
      
      alert('Your subscription has been resumed!');
      await fetchSubscription();
    } catch (error: any) {
      console.error('Error resuming:', error);
      alert('Failed to resume: ' + error.message);
    } finally {
      setResumingPlan(false);
    }
  };

  const handleManageBilling = async () => {
    setManagingBilling(true);
    try {
      const response = await fetch('/api/stripe/create-portal-session', {
        method: 'POST',
      });
      const data = await response.json();
      
      if (!response.ok) throw new Error(data.error || 'Failed to open billing portal');
      
      // Redirect to Stripe billing portal
      window.location.href = data.url;
    } catch (error: any) {
      console.error('Error opening billing portal:', error);
      alert('Failed to open billing portal: ' + error.message);
    } finally {
      setManagingBilling(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const creditsUsed = subscription?.peopleAddedCount || 0;
  const creditsRemaining = FREE_LIMIT - creditsUsed;

  return (
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your account and subscription</p>
        </div>

        {/* Account Section */}
        <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6 mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Account</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground">Email</label>
              <p className="text-foreground font-medium">{userEmail || 'Not set'}</p>
            </div>
          </div>
        </div>

        {/* Subscription Section */}
        <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-foreground">Subscription</h2>
            {subscription?.planType === 'paid' && (
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                subscription.cancelAtPeriodEnd 
                  ? 'bg-orange-500/20 text-orange-400'
                  : 'bg-emerald-500/20 text-emerald-400'
              }`}>
                {subscription.cancelAtPeriodEnd ? 'Cancelling' : 'Active'}
              </span>
            )}
          </div>

          {subscription?.planType === 'free' ? (
            /* Free Plan */
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-white/10 rounded-lg">
                  <CreditCard className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Free Plan</h3>
                  <p className="text-sm text-muted-foreground">Limited to {FREE_LIMIT} cadence adds</p>
                </div>
              </div>

              {/* Usage */}
              <div className="bg-white/5 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">Usage</span>
                  <span className="text-sm text-muted-foreground">{creditsUsed}/{FREE_LIMIT} used</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                  <div 
                    className={`h-2 rounded-full transition-all ${creditsRemaining <= 1 ? 'bg-red-500' : 'bg-indigo-600'}`}
                    style={{ width: `${(creditsUsed / FREE_LIMIT) * 100}%` }}
                  />
                </div>
                {creditsRemaining <= 0 ? (
                  <p className="text-sm text-red-600 font-medium">
                    You&apos;ve reached your limit. Upgrade to add more people to cadences.
                  </p>
                ) : creditsRemaining === 1 ? (
                  <p className="text-sm text-orange-600">
                    Only {creditsRemaining} cadence add remaining
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {creditsRemaining} cadence adds remaining
                  </p>
                )}
              </div>

              {/* Upgrade Button */}
              <button
                onClick={() => router.push('/upgrade')}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white hover:bg-indigo-700 transition-colors font-medium rounded-lg"
              >
                <Zap className="h-5 w-5" />
                Upgrade to Pro - $30/month
              </button>

              {/* Features comparison */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h4 className="text-sm font-medium text-foreground mb-3">Pro Plan includes:</h4>
                <ul className="space-y-2">
                  {[
                    'Unlimited cadence adds',
                    'Priority email delivery',
                    'Advanced analytics',
                    'Priority support',
                  ].map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            /* Paid Plan */
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <Zap className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Pro Plan</h3>
                  <p className="text-sm text-muted-foreground">$30/month • Unlimited cadence adds</p>
                </div>
              </div>

              {/* Billing Info */}
              <div className="bg-white/5 rounded-lg p-4 mb-6 space-y-3">
                {subscription?.cancelAtPeriodEnd ? (
                  <div className="flex items-start gap-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
                    <XCircle className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-orange-800">Subscription cancelling</p>
                      <p className="text-sm text-orange-700">
                        Your Pro access ends on {subscription.currentPeriodEnd ? formatDate(subscription.currentPeriodEnd) : 'soon'}.
                        Active cadences will be paused after this date.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        Next billing date: {subscription?.currentPeriodEnd ? formatDate(subscription.currentPeriodEnd) : 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {subscription?.peopleAddedCount || 0} people added to cadences
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Actions */}
              <div className="space-y-3">
                {subscription?.stripeCustomerId && (
                  <button
                    onClick={handleManageBilling}
                    disabled={managingBilling}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 text-foreground hover:bg-gray-200 transition-colors font-medium rounded-lg"
                  >
                    {managingBilling ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ExternalLink className="h-4 w-4" />
                    )}
                    Manage Billing & Payment Method
                  </button>
                )}

                {subscription?.cancelAtPeriodEnd ? (
                  <button
                    onClick={handleResumeSubscription}
                    disabled={resumingPlan}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 transition-colors font-medium rounded-lg"
                  >
                    {resumingPlan ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4" />
                    )}
                    Resume Subscription
                  </button>
                ) : (
                  <button
                    onClick={handleCancelSubscription}
                    disabled={cancellingPlan}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-red-600 hover:bg-red-50 transition-colors font-medium rounded-lg border border-red-200"
                  >
                    {cancellingPlan ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                    Cancel Subscription
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Help Section */}
        <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Need Help?</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Have questions about billing or your subscription? We&apos;re here to help.
          </p>
          <a
            href="mailto:support@getcheddar.com"
            className="inline-flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
          >
            <Mail className="h-4 w-4" />
            Contact Support
          </a>
        </div>
      </div>
    </div>
  );
}







