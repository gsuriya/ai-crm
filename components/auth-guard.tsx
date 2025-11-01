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
    const checkAuth = async () => {
      const session = await getSession();
      
      // Allow access to auth pages
      if (isAuthPage) {
        if (session) {
          router.push('/companies');
        } else {
          setIsChecking(false);
        }
        return;
      }

      // Protect all other routes
      if (!session) {
        router.push('/auth/signin');
      } else {
        setIsChecking(false);
      }
    };

    checkAuth();
  }, [router, pathname, isAuthPage]);

  // Show loading state while checking auth
  if (isChecking && !isAuthPage) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return <>{children}</>;
}

