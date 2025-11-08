"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CardSectionProps {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function CardSection({ title, action, children, className }: CardSectionProps) {
  return (
    <section className={cn("relative", className)}>
      <div className="pt-8 pb-4">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-base font-semibold tracking-tight text-foreground">{title}</h3>
          {action}
        </div>
        <div className="space-y-4">
          {children}
        </div>
      </div>
    </section>
  );
}

