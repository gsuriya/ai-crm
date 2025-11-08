"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Building2, Home, Users, Briefcase, Workflow, CheckSquare, BarChart3, LogOut, LogIn, Send, Settings, HelpCircle, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

const navigation = [
  { name: "Home", href: "/", icon: Home },
  { name: "Companies", href: "/companies", icon: Building2 },
  { name: "Ongoing", href: "/outreach", icon: Send },
  { name: "Cadences", href: "/cadences", icon: Workflow },
  { name: "People", href: "/people", icon: Users },
  { name: "Pipeline", href: "/pipeline", icon: Briefcase },
  { name: "Tasks", href: "/tasks", icon: CheckSquare },
  { name: "Insights", href: "/insights", icon: BarChart3 },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userImage, setUserImage] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setIsAuthenticated(!!session);
        
        if (session?.user) {
          setUserEmail(session.user.email || null);
          // Get profile image from user_metadata (Google OAuth provides this)
          const metadata = session.user.user_metadata || {};
          const avatarUrl = metadata.avatar_url || 
                           metadata.picture ||
                           metadata.avatar;
          
          if (avatarUrl) {
            console.log('Setting user image from session:', avatarUrl);
            setUserImage(avatarUrl);
          } else {
            // Fallback: try to get from app_metadata or check if we need to fetch user
            const { data: { user } } = await supabase.auth.getUser();
            if (user?.user_metadata) {
              const userMetadata = user.user_metadata;
              const fallbackUrl = userMetadata.avatar_url || 
                                 userMetadata.picture ||
                                 userMetadata.avatar;
              if (fallbackUrl) {
                console.log('Setting user image from getUser:', fallbackUrl);
                setUserImage(fallbackUrl);
              } else {
                console.log('No avatar URL found in user metadata:', userMetadata);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error checking auth:', error);
        setIsAuthenticated(false);
      }
    };
    checkAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setIsAuthenticated(true);
        setUserEmail(session.user.email || null);
        
        const metadata = session.user.user_metadata || {};
        const avatarUrl = metadata.avatar_url || 
                         metadata.picture ||
                         metadata.avatar;
        
        if (avatarUrl) {
          setUserImage(avatarUrl);
        } else {
          // Try to get fresh user data
          const { data: { user } } = await supabase.auth.getUser();
          if (user?.user_metadata) {
            const userMetadata = user.user_metadata;
            const fallbackUrl = userMetadata.avatar_url || 
                               userMetadata.picture ||
                               userMetadata.avatar;
            if (fallbackUrl) {
              setUserImage(fallbackUrl);
            }
          }
        }
      } else {
        setIsAuthenticated(false);
        setUserEmail(null);
        setUserImage(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Fetch notification count
  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchNotificationCount = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Get total unread events across all companies
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
    // Refresh every 30 seconds
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
      
      {/* Navigation - icons above text */}
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
      {/* Bottom section with notifications and profile */}
      <div className="py-2 flex-shrink-0 flex flex-col items-center gap-2 relative">
        {isAuthenticated === null ? (
          <div className="text-[10px] text-muted-foreground text-center py-0.5">...</div>
        ) : isAuthenticated ? (
          <>
            {/* Notification Bell */}
            <button
              onClick={() => router.push('/companies')}
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
            <div className="relative">
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
                    onError={(e) => {
                      console.error('Failed to load profile image:', userImage);
                      setUserImage(null);
                    }}
                    onLoad={() => {
                      console.log('Profile image loaded successfully:', userImage);
                    }}
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
                  <div className="absolute bottom-full left-full ml-2 mb-0 w-48 bg-background border border-border rounded-lg shadow-lg z-50">
                    <div className="p-2 border-b border-border">
                      <div className="text-[10px] text-muted-foreground mb-0.5">Signed in as</div>
                      <div className="text-xs font-medium text-foreground truncate">
                        {userEmail || 'User'}
                      </div>
                    </div>
                    <div className="py-0.5">
                      <button
                        onClick={() => {
                          setShowDropdown(false);
                          router.push('/settings');
                        }}
                        className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-foreground hover:bg-muted transition-colors"
                      >
                        <Settings className="h-3.5 w-3.5" />
                        Settings
                      </button>
                      <button
                        onClick={() => {
                          setShowDropdown(false);
                          window.location.href = 'mailto:support@example.com';
                        }}
                        className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-foreground hover:bg-muted transition-colors"
                      >
                        <HelpCircle className="h-3.5 w-3.5" />
                        Contact support
                      </button>
                      <div className="border-t border-border my-0.5" />
                      <button
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-foreground hover:bg-muted transition-colors"
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
          <Link href="/auth/signin" className="w-full px-2">
            <Button
              variant="default"
              className="w-full flex items-center justify-center gap-1.5 py-1.5 h-auto text-xs"
              size="sm"
            >
              <LogIn className="h-3 w-3" />
              <span>Sign In</span>
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}

