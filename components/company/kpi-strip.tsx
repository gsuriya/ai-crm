"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface KpiItem {
  label: string;
  value: string;
  onClick?: () => void;
  icon?: ReactNode;
}

interface KpiStripProps {
  items: KpiItem[];
}

export function KpiStrip({ items }: KpiStripProps) {
  return (
    <div className="flex items-center gap-6 overflow-x-auto pb-2 scrollbar-hide">
      {items.map((kpi, i) => (
        <button
          key={i}
          onClick={kpi.onClick}
          className={cn(
            "group flex flex-col gap-1 px-0 py-2 text-left transition-colors duration-200 min-w-0 flex-shrink-0",
            "hover:text-foreground",
            kpi.onClick && "cursor-pointer"
          )}
        >
          <div className="text-xs text-muted-foreground truncate">{kpi.label}</div>
          <div className="text-2xl font-bold text-foreground truncate">{kpi.value}</div>
        </button>
      ))}
    </div>
  );
}

