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
  { name: "Ongoing", href: "/outreach", icon: Send },
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
      <div className="border-t-2 border-border p-4 flex-shrink-0">
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

