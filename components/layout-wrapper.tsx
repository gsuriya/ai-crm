"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { AuthGuard } from "@/components/auth-guard";
import { CommandBar } from "@/components/command-bar";

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname.startsWith('/auth');
  const [commandBarOpen, setCommandBarOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ⌘K or Ctrl+K to open command bar
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandBarOpen((open) => !open);
      }
      // Escape to close
      if (e.key === 'Escape' && commandBarOpen) {
        setCommandBarOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commandBarOpen]);

  // Global background processor for scheduled cadence executions
  useEffect(() => {
    if (isAuthPage) return; // Don't run on auth pages

    const processScheduledExecutions = async () => {
      try {
        const response = await fetch('/api/cadence/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        const data = await response.json();
        if (data.processed > 0) {
          console.log(`[Background Processor] ✅ Processed ${data.processed} scheduled execution(s)`);
        }
      } catch (error) {
        // Silently fail - don't spam console
      }
    };

    // Process immediately on page load
    processScheduledExecutions();

    // Set up interval to check every 10 seconds
    const interval = setInterval(() => {
      processScheduledExecutions();
    }, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, [isAuthPage]);

  return (
    <AuthGuard>
      {isAuthPage ? (
        <>{children}</>
      ) : (
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto bg-background min-w-0 pl-8">
            {children}
          </main>
          <CommandBar open={commandBarOpen} onOpenChange={setCommandBarOpen} />
        </div>
      )}
    </AuthGuard>
  );
}

