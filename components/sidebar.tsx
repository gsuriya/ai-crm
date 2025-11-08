"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Building2, Home, Users, Briefcase, Workflow, CheckSquare, BarChart3, LogOut, LogIn, Send, Settings, HelpCircle } from "lucide-react";
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
      className="flex w-64 flex-shrink-0 flex-col border-r-2 border-border bg-background h-screen" 
      style={{ zIndex: 10 }}
    >
      <div className="flex h-16 items-center border-b-2 border-border px-6 flex-shrink-0">
        <Link href="/" className="flex items-center space-x-2">
          <img 
            src="/logo.png" 
            alt="Cheddar CRM Logo" 
            className="h-12 w-12"
          />
          <span className="text-lg font-semibold text-foreground">Cheddar CRM</span>
        </Link>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "group flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-blue-400 text-white shadow-sm"
                  : "text-foreground/70 hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className={cn(
                "mr-3 h-5 w-5 transition-colors",
                isActive ? "text-white" : "text-foreground/60 group-hover:text-foreground"
              )} />
              {item.name}
            </Link>
          );
        })}
      </nav>
      <div className="border-t-2 border-border p-3 flex-shrink-0 relative">
        {isAuthenticated === null ? (
          <div className="text-xs text-muted-foreground text-center py-2">Checking...</div>
        ) : isAuthenticated ? (
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="w-full flex items-center gap-3 rounded-lg p-2 hover:bg-muted transition-colors"
            >
              {userImage ? (
                <img
                  src={userImage}
                  alt="Profile"
                  className="h-8 w-8 rounded-full object-cover flex-shrink-0"
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
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-medium text-primary">
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
                <div className="absolute bottom-full left-0 mb-2 w-64 bg-background border-2 border-border rounded-lg shadow-lg z-50">
                  <div className="p-3 border-b border-border">
                    <div className="text-xs text-muted-foreground mb-1">Signed in as</div>
                    <div className="text-sm font-medium text-foreground truncate">
                      {userEmail || 'User'}
                    </div>
                  </div>
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setShowDropdown(false);
                        // Navigate to settings if you have a settings page
                        router.push('/settings');
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                    >
                      <Settings className="h-4 w-4" />
                      Settings
                    </button>
                    <button
                      onClick={() => {
                        setShowDropdown(false);
                        // You can add a contact support page or mailto link
                        window.location.href = 'mailto:support@example.com';
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                    >
                      <HelpCircle className="h-4 w-4" />
                      Contact support
                    </button>
                    <div className="border-t border-border my-1" />
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <Link href="/auth/signin">
            <Button
              variant="default"
              className="w-full justify-start"
            >
              <LogIn className="mr-2 h-4 w-4" />
              Sign In with Google
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}

