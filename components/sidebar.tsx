"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Building2, Send, Workflow, LogOut, LogIn, Settings, HelpCircle, Bell, Zap, ArrowRight, CreditCard, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

const navigation = [
  { name: "Companies", href: "/companies", icon: Building2 },
  { name: "Outreach", href: "/outreach", icon: Send },
  { name: "Cadences", href: "/cadences", icon: Workflow },
];

interface SubscriptionInfo {
  planType: 'free' | 'paid';
  peopleAddedCount: number;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userImage, setUserImage] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [subscription, setSubscription] = useState<SubscriptionInfo>({
    planType: 'free',
    peopleAddedCount: 0,
    cancelAtPeriodEnd: false,
    currentPeriodEnd: null
  });
  const [cancellingPlan, setCancellingPlan] = useState(false);

  const creditsRemaining = 5 - subscription.peopleAddedCount;
  const totalCredits = 5;

  // Fetch user's subscription plan
  useEffect(() => {
    const fetchUserPlan = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: sub } = await supabase
          .from('user_subscriptions')
          .select('plan_type, people_added_count, cancel_at_period_end, current_period_end, status')
          .eq('user_id', user.id)
          .single();

        if (sub) {
          setSubscription({
            planType: sub.plan_type === 'paid' && sub.status === 'active' ? 'paid' : 'free',
            peopleAddedCount: sub.people_added_count || 0,
            cancelAtPeriodEnd: sub.cancel_at_period_end || false,
            currentPeriodEnd: sub.current_period_end
          });
        }
      } catch (error) {
        console.error('Error fetching user plan:', error);
      }
    };

    fetchUserPlan();
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setIsAuthenticated(!!session);
        
        if (session?.user) {
          setUserEmail(session.user.email || null);
          const metadata = session.user.user_metadata || {};
          const avatarUrl = metadata.avatar_url || metadata.picture || metadata.avatar;
          
          if (avatarUrl) {
            setUserImage(avatarUrl);
          } else {
            const { data: { user } } = await supabase.auth.getUser();
            if (user?.user_metadata) {
              const userMetadata = user.user_metadata;
              const fallbackUrl = userMetadata.avatar_url || userMetadata.picture || userMetadata.avatar;
              if (fallbackUrl) setUserImage(fallbackUrl);
            }
          }
        }
      } catch (error) {
        console.error('Error checking auth:', error);
        setIsAuthenticated(false);
      }
    };
    checkAuth();

    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setIsAuthenticated(true);
        setUserEmail(session.user.email || null);
        
        const metadata = session.user.user_metadata || {};
        const avatarUrl = metadata.avatar_url || metadata.picture || metadata.avatar;
        
        if (avatarUrl) {
          setUserImage(avatarUrl);
        } else {
          const { data: { user } } = await supabase.auth.getUser();
          if (user?.user_metadata) {
            const userMetadata = user.user_metadata;
            const fallbackUrl = userMetadata.avatar_url || userMetadata.picture || userMetadata.avatar;
            if (fallbackUrl) setUserImage(fallbackUrl);
          }
        }
      } else {
        setIsAuthenticated(false);
        setUserEmail(null);
        setUserImage(null);
      }
    });

    return () => {
      authSub.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchNotificationCount = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { count, error } = await supabase
          .from('company_events')
          .select('*', { count: 'exact', head: true })
          .eq('is_new', true);

        if (!error && count !== null) {
          setNotificationCount(count);
        }
      } catch (error) {
        console.error('Error fetching notification count:', error);
      }
    };

    fetchNotificationCount();
    const interval = setInterval(fetchNotificationCount, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const handleSignOut = async () => {
    try {
      await signOut();
      setIsAuthenticated(false);
      router.push("/auth/signin");
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  const handleCancelSubscription = async () => {
    const endDate = subscription.currentPeriodEnd 
      ? new Date(subscription.currentPeriodEnd).toLocaleDateString()
      : 'end of billing period';
    
    if (!confirm(`Are you sure you want to cancel? You'll keep access until ${endDate}.`)) return;

    setCancellingPlan(true);
    try {
      const response = await fetch('/api/stripe/cancel-subscription', {
        method: 'POST',
      });
      const data = await response.json();
      
      if (!response.ok) throw new Error(data.error || 'Failed to cancel');
      
      alert(`Your subscription will cancel on ${endDate}. You'll keep all paid features until then.`);
      setSubscription(prev => ({ ...prev, cancelAtPeriodEnd: true }));
      setShowDropdown(false);
    } catch (error: any) {
      console.error('Error cancelling:', error);
      alert('Failed to cancel: ' + error.message);
    } finally {
      setCancellingPlan(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div 
      data-sidebar 
      className="flex flex-shrink-0 flex-col border-r border-gray-100 bg-background h-screen" 
      style={{ zIndex: 10 }}
    >
      {/* Logo at top */}
      <div className="flex h-16 items-center justify-center flex-shrink-0">
        <Link href="/" className="flex items-center justify-center">
          <img 
            src="/logo.png" 
            alt="Cheddar Logo" 
            className="h-10 w-10 object-contain filter drop-shadow-sm"
            style={{ imageRendering: 'crisp-edges' }}
          />
        </Link>
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-2 py-3 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "group flex flex-col items-center justify-center rounded-lg py-2 px-1 transition-all duration-200",
                isActive
                  ? "bg-indigo-50 text-indigo-600"
                  : "text-black hover:bg-muted/50"
              )}
            >
              <item.icon className={cn(
                "h-5 w-5 mb-1 transition-colors",
                isActive ? "text-indigo-600" : "text-black"
              )} />
              <span className={cn(
                "text-[10px] font-medium text-center leading-tight",
                isActive ? "text-indigo-600" : "text-black"
              )}>
                {item.name}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Usage section - ONLY show for FREE plan users */}
      {subscription.planType === 'free' && (
        <div className="px-2 pb-3 flex-shrink-0">
          <button
            onClick={() => router.push('/upgrade')}
            className="w-full bg-muted/30 hover:bg-muted/50 rounded-lg p-2.5 transition-colors group"
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[10px] font-medium text-foreground">Usage</span>
              </div>
              <ArrowRight className="h-3 w-3 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
            </div>
            <div className="w-full bg-muted rounded-full h-1.5 mb-1.5">
              <div 
                className="bg-indigo-600 h-1.5 rounded-full transition-all"
                style={{ width: `${((totalCredits - creditsRemaining) / totalCredits) * 100}%` }}
              />
            </div>
            <div className="text-[10px] text-muted-foreground">
              {Math.max(0, creditsRemaining)}/{totalCredits} cadence adds left
            </div>
          </button>
        </div>
      )}

      {/* Bottom section with notifications and profile */}
      <div className="py-2 flex-shrink-0 flex flex-col items-center gap-2 relative">
        {isAuthenticated === null ? (
          <div className="text-[10px] text-muted-foreground text-center py-0.5">...</div>
        ) : isAuthenticated ? (
          <>
            {/* Notification Bell */}
            <button
              onClick={() => router.push('/people')}
              className="relative flex items-center justify-center w-10 h-10 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <Bell className="h-5 w-5 text-black hover:text-black/80" />
              {notificationCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-white text-[9px] font-semibold">
                  {notificationCount > 99 ? '99+' : notificationCount}
                </span>
              )}
            </button>

            {/* Profile Picture */}
            <div className="relative flex flex-col items-center">
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-muted/50 transition-colors p-0.5"
              >
                {userImage ? (
                  <img
                    src={userImage}
                    alt="Profile"
                    className="h-full w-full rounded-lg object-cover flex-shrink-0"
                    referrerPolicy="no-referrer"
                    onError={() => setUserImage(null)}
                  />
                ) : (
                  <div className="h-full w-full rounded-lg bg-indigo-100 flex items-center justify-center">
                    <span className="text-sm font-medium text-indigo-600">
                      {userEmail ? userEmail.charAt(0).toUpperCase() : 'U'}
                    </span>
                  </div>
                )}
              </button>
              
              {showDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowDropdown(false)}
                  />
                  <div className="absolute bottom-full left-full ml-2 mb-0 w-56 bg-background border border-border rounded-lg shadow-lg z-50">
                    {/* User Info */}
                    <div className="p-3 border-b border-border">
                      <div className="text-[10px] text-muted-foreground mb-0.5">Signed in as</div>
                      <div className="text-sm font-medium text-foreground truncate">
                        {userEmail || 'User'}
                      </div>
                    </div>
                    
                    {/* Billing Section */}
                    <div className="p-3 border-b border-border">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-foreground">
                          {subscription.planType === 'paid' ? 'Pro Plan' : 'Free Plan'}
                        </span>
                        {subscription.planType === 'paid' && !subscription.cancelAtPeriodEnd && (
                          <span className="text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded">Active</span>
                        )}
                        {subscription.cancelAtPeriodEnd && (
                          <span className="text-[10px] text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">Cancelling</span>
                        )}
                      </div>
                      
                      {subscription.planType === 'free' ? (
                        <>
                          <div className="text-[10px] text-muted-foreground mb-2">
                            {Math.max(0, creditsRemaining)}/{totalCredits} cadence adds remaining
                          </div>
                          <button
                            onClick={() => {
                              setShowDropdown(false);
                              router.push('/upgrade');
                            }}
                            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs bg-indigo-600 text-white hover:bg-indigo-700 transition-colors font-medium rounded-md"
                          >
                            <Zap className="h-3.5 w-3.5" />
                            Upgrade to Pro
                          </button>
                        </>
                      ) : subscription.cancelAtPeriodEnd ? (
                        <div className="text-[11px] text-muted-foreground">
                          Your subscription will end on <span className="font-medium text-foreground">{formatDate(subscription.currentPeriodEnd)}</span>. You&apos;ll keep all Pro features until then.
                        </div>
                      ) : (
                        <>
                          <div className="text-[10px] text-muted-foreground mb-2">
                            Renews {formatDate(subscription.currentPeriodEnd)}
                          </div>
                          <button
                            onClick={handleCancelSubscription}
                            disabled={cancellingPlan}
                            className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-[11px] text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors rounded-md"
                          >
                            {cancellingPlan ? 'Cancelling...' : 'Cancel subscription'}
                          </button>
                        </>
                      )}
                    </div>

                    {/* Menu Items */}
                    <div className="py-1">
                      <button
                        onClick={() => {
                          setShowDropdown(false);
                          router.push('/settings');
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-muted transition-colors"
                      >
                        <Settings className="h-3.5 w-3.5" />
                        Settings
                      </button>
                      <button
                        onClick={() => {
                          setShowDropdown(false);
                          window.location.href = 'mailto:support@getcheddar.com';
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-muted transition-colors"
                      >
                        <HelpCircle className="h-3.5 w-3.5" />
                        Help & Support
                      </button>
                      <div className="border-t border-border my-1" />
                      <button
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-muted transition-colors"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        Sign out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        ) : (
          <Link
            href="/auth/signin"
            className="group flex flex-col items-center justify-center rounded-lg py-2 px-1 transition-all duration-200 text-black hover:bg-muted/50 w-full"
          >
            <LogIn className="h-5 w-5 mb-1 transition-colors text-black" />
            <span className="text-[10px] font-medium text-center leading-tight text-black">
              Sign In
            </span>
          </Link>
        )}
      </div>
    </div>
  );
}
