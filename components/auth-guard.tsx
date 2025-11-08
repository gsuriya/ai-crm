"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getSession } from "@/lib/auth";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isChecking, setIsChecking] = useState(false); // Set to false initially for development
  const isAuthPage = pathname.startsWith('/auth');

  useEffect(() => {
    // TEMPORARY: Skip auth check entirely for development
    // This allows the app to load immediately without waiting for auth
    setIsChecking(false);
  }, []);

  // Show loading state while checking auth (only for protected routes)
  if (isChecking && !isAuthPage) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

