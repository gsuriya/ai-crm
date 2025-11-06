"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getSession } from "@/lib/auth";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isChecking, setIsChecking] = useState(true);
  const isAuthPage = pathname.startsWith('/auth');

  useEffect(() => {
    // Skip auth check for auth pages - let them render immediately
    if (isAuthPage) {
      setIsChecking(false);
      return;
    }

    let cancelled = false;

    const checkAuth = async () => {
      try {
        // Add a timeout to prevent hanging
        const timeoutPromise = new Promise<null>((resolve) => 
          setTimeout(() => {
            if (!cancelled) {
              console.warn('Auth check timeout, redirecting to sign in');
              resolve(null);
            }
          }, 2000)
        );
        
        const sessionPromise = getSession().catch(() => null);
        const session = await Promise.race([sessionPromise, timeoutPromise]);
        
        if (cancelled) return;
        
        // Protect all other routes
        if (!session) {
          console.log('No session found, redirecting to sign in');
          router.push('/auth/signin');
        } else {
          console.log('Session found, allowing access');
          setIsChecking(false);
        }
      } catch (error) {
        if (cancelled) return;
        console.error('Auth check error:', error);
        // On error, redirect to sign in
          router.push('/auth/signin');
      }
    };

    checkAuth();
    
    return () => {
      cancelled = true;
    };
  }, [router, pathname, isAuthPage]);

  // Show loading state while checking auth (only for protected routes)
  if (isChecking && !isAuthPage) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return <>{children}</>;
}

