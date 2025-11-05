"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Building2, Home, Users, Briefcase, Workflow, CheckSquare, BarChart3, Settings, LogOut, LogIn, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut, getSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";

const navigation = [
  { name: "Home", href: "/", icon: Home },
  { name: "Companies", href: "/companies", icon: Building2 },
  { name: "People", href: "/people", icon: Users },
  { name: "Pipeline", href: "/pipeline", icon: Briefcase },
  { name: "Cadences", href: "/cadences", icon: Workflow },
  { name: "Current outreach", href: "/outreach", icon: Send },
  { name: "Tasks", href: "/tasks", icon: CheckSquare },
  { name: "Insights", href: "/insights", icon: BarChart3 },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const session = await getSession();
        setIsAuthenticated(!!session);
      } catch (error) {
        setIsAuthenticated(false);
      }
    };
    checkAuth();
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
      className="flex w-64 flex-shrink-0 flex-col border-r border-border bg-background h-screen" 
      style={{ zIndex: 10 }}
    >
      <div className="flex h-16 items-center border-b border-border px-6 flex-shrink-0">
        <Link href="/" className="flex items-center space-x-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <Building2 className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-semibold text-foreground">AI CRM</span>
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
                "group flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <item.icon className="mr-3 h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border p-4 flex-shrink-0">
        {isAuthenticated === null ? (
          <div className="text-xs text-muted-foreground text-center py-2">Checking...</div>
        ) : isAuthenticated ? (
          <Button
            variant="outline"
            onClick={handleSignOut}
            className="w-full justify-start"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
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

