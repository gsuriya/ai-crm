"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { AuthGuard } from "@/components/auth-guard";
import { CommandBar } from "@/components/command-bar";
import LightPillar from "@/components/LightPillar";

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname.startsWith('/auth');
  const [commandBarOpen, setCommandBarOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K to open command bar
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

  // Background reply checker - checks every 5 minutes for email responses
  useEffect(() => {
    if (isAuthPage) return;

    const checkForReplies = async () => {
      try {
        const response = await fetch('/api/cadence/check-replies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        const data = await response.json();
        if (data.results?.active?.paused > 0 || data.results?.completed?.responded > 0) {
          console.log(`[Reply Checker] 📬 Found replies! Active paused: ${data.results.active.paused}, Completed responded: ${data.results.completed.responded}`);
          
          // Show browser notification
          if (Notification.permission === 'granted') {
            new Notification('📬 New Email Reply!', {
              body: `Someone responded to your outreach`,
              icon: '/favicon.ico',
            });
          } else if (Notification.permission !== 'denied') {
            Notification.requestPermission();
          }
        }
      } catch (error) {
        // Silently fail
      }
    };

    // Check immediately on page load
    checkForReplies();

    // Check every 5 minutes (300000ms)
    const replyInterval = setInterval(() => {
      checkForReplies();
    }, 300000);

    return () => clearInterval(replyInterval);
  }, [isAuthPage]);

  return (
    <AuthGuard>
      {isAuthPage ? (
        <>{children}</>
      ) : (
        <div className="flex h-screen overflow-hidden" style={{ backgroundColor: '#060010', position: 'relative' }}>
          {/* Global LightPillar background */}
          <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
            <LightPillar
              topColor="#5227FF"
              bottomColor="#FF9FFC"
              intensity={1}
              rotationSpeed={0.3}
              glowAmount={0.002}
              pillarWidth={3}
              pillarHeight={0.4}
              noiseIntensity={0.5}
              pillarRotation={25}
              interactive={false}
              mixBlendMode="screen"
              quality="high"
            />
          </div>
          <Sidebar />
          <main className="flex-1 overflow-y-auto min-w-0 pl-8" style={{ position: 'relative', zIndex: 1, backgroundColor: 'transparent' }}>
            {children}
          </main>
          <CommandBar open={commandBarOpen} onOpenChange={setCommandBarOpen} />
        </div>
      )}
    </AuthGuard>
  );
}

