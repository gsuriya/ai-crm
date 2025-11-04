"use client";

import { useRouter, usePathname } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileText,
  User,
  History,
  DollarSign,
  FileUp,
  Sparkles,
  Workflow,
} from "lucide-react";
import { useEffect } from "react";

interface CompanyTabsProps {
  companyId: string;
  currentTab: string;
}

export function CompanyTabs({ companyId, currentTab }: CompanyTabsProps) {
  const router = useRouter();
  const pathname = usePathname();

  const tabs = [
    { id: "overview", label: "Overview", icon: FileText, shortcut: "o" },
    { id: "people", label: "People", icon: User, shortcut: "p" },
    { id: "activity", label: "Activity", icon: History, shortcut: "a" },
    { id: "financials", label: "Financials", icon: DollarSign, shortcut: "f" },
    { id: "notes", label: "Notes", icon: FileText, shortcut: "n" },
    { id: "docs", label: "Docs", icon: FileUp, shortcut: "d" },
    { id: "ai-insights", label: "AI Insights", icon: Sparkles, shortcut: "i" },
    { id: "cadences", label: "Cadences", icon: Workflow, shortcut: "c" },
  ];

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
    <Tabs value={currentTab} onValueChange={handleTabChange}>
      <TabsList className="grid w-full grid-cols-8">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="flex items-center gap-2 text-xs"
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}


