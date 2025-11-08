"use client";

import { useRouter, usePathname } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileText,
  User,
  History,
  DollarSign,
  FileUp,
  Workflow,
  Bell,
} from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface CompanyTabsProps {
  companyId: string;
  currentTab: string;
}

export function CompanyTabs({ companyId, currentTab }: CompanyTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [unreadEventCount, setUnreadEventCount] = useState(0);

  const tabs = [
    { id: "overview", label: "Overview", icon: FileText, shortcut: "o" },
    { id: "people", label: "People", icon: User, shortcut: "p" },
    { id: "activity", label: "Activity", icon: History, shortcut: "a" },
    { id: "financials", label: "Financials", icon: DollarSign, shortcut: "f" },
    { id: "notes", label: "Notes", icon: FileText, shortcut: "n" },
    { id: "docs", label: "Docs", icon: FileUp, shortcut: "d" },
    { id: "cadences", label: "Cadences", icon: Workflow, shortcut: "c" },
    { id: "events", label: "Events", icon: Bell, shortcut: "e" },
  ];

  // Fetch unread event count
  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const response = await fetch(`/api/monitoring/unread-count?companyId=${companyId}`);
        if (response.ok) {
          const data = await response.json();
          setUnreadEventCount(data.count || 0);
        }
      } catch (error) {
        console.error('Error fetching unread count:', error);
      }
    };

    fetchUnreadCount();
    
    // Refresh count when tab changes (in case events were marked as read)
    const interval = setInterval(fetchUnreadCount, 5000); // Poll every 5 seconds
    
    return () => clearInterval(interval);
  }, [companyId, currentTab]);

  const handleTabChange = (value: string) => {
    router.push(`/companies/${companyId}/${value}`);
  };

  // Keyboard shortcuts: g + tab shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if we're on a company page
      if (!pathname?.startsWith(`/companies/${companyId}`)) return;

      // Check if 'g' was pressed (as a prefix)
      if (e.key === "g" && !e.metaKey && !e.ctrlKey) {
        const handleShortcut = (shortcutEvent: KeyboardEvent) => {
          if (shortcutEvent.key === "Escape") {
            window.removeEventListener("keydown", handleShortcut);
            return;
          }

          const tab = tabs.find((t) => t.shortcut === shortcutEvent.key.toLowerCase());
          if (tab) {
            e.preventDefault();
            shortcutEvent.preventDefault();
            handleTabChange(tab.id);
            window.removeEventListener("keydown", handleShortcut);
          }
        };

        window.addEventListener("keydown", handleShortcut);
        // Clean up after 2 seconds if no key pressed
        setTimeout(() => {
          window.removeEventListener("keydown", handleShortcut);
        }, 2000);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [companyId, pathname, tabs]);

  return (
    <div className="sticky top-0 z-30 bg-background border-b border-border">
      <div className="relative overflow-x-auto">
        {/* Scroll shadows */}
        <div className="pointer-events-none absolute left-0 top-0 h-full w-6 bg-gradient-to-r from-background to-transparent z-10" />
        <div className="pointer-events-none absolute right-0 top-0 h-full w-6 bg-gradient-to-l from-background to-transparent z-10" />
        
        <Tabs value={currentTab} onValueChange={handleTabChange}>
          <TabsList className="flex gap-2 px-4 py-2 min-h-[48px] w-full overflow-x-auto scrollbar-hide">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const showBadge = tab.id === "events" && unreadEventCount > 0;
              return (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className={cn(
                    "inline-flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-all",
                    "text-muted-foreground border border-transparent",
                    "data-[state=active]:bg-muted data-[state=active]:text-foreground data-[state=active]:border-border",
                    "hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{tab.label}</span>
                  {showBadge && (
                    <span className="ml-1 flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-red-500 text-white text-[10px] font-semibold">
                      {unreadEventCount > 99 ? '99+' : unreadEventCount}
                    </span>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
      </div>
    </div>
  );
}


