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

    const checkAuth = async () => {
      try {
        // Add a timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 5000)
        );
        
        const sessionPromise = getSession();
        const session = await Promise.race([sessionPromise, timeoutPromise]).catch((err) => {
          console.warn('Auth check timeout or error:', err);
          return null;
        }) as any;
        
        // Protect all other routes
        if (!session) {
          router.push('/auth/signin');
        } else {
          setIsChecking(false);
        }
      } catch (error) {
        console.error('Auth check error:', error);
        setIsChecking(false);
        router.push('/auth/signin');
      }
    };

    checkAuth();
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

