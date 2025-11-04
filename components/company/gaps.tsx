"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { User, Plus, Mail, Calendar, Sparkles } from "lucide-react";
import { EmptyState } from "./empty-state";
import { motion } from "framer-motion";
import type { Person } from "@/lib/types/company";

interface GapsProps {
  companyId: string;
  people: Person[];
}

interface Gap {
  id: string;
  type: "missing-contact" | "domain-mismatch" | "alias-suggestion";
  title: string;
  description: string;
  suggestion: string;
  confidence: number; // 0-100
}

export function Gaps({ companyId, people }: GapsProps) {
  const [gaps, setGaps] = useState<Gap[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGaps();
  }, [companyId, people]);

  const fetchGaps = async () => {
    try {
      setLoading(true);
      // Call AI endpoint for coverage gaps
      const response = await fetch(`/api/ai/coverage-gaps?companyId=${companyId}`);
      if (response.ok) {
        const data = await response.json();
        setGaps(data.gaps || []);
      } else {
        // Mock data for now
        setGaps([
          {
            id: "1",
            type: "missing-contact",
            title: "Missing CTO contact",
            description: "CTO mentioned in email but not in contacts",
            suggestion: "Add John Doe (john@company.com) as CTO",
            confidence: 85,
          },
          {
            id: "2",
            type: "domain-mismatch",
            title: "Domain mismatch detected",
            description: "Email from company.com but contact uses company.io",
            suggestion: "Verify and update domain mapping",
            confidence: 70,
          },
        ]);
      }
    } catch (error) {
      console.error("Error fetching gaps:", error);
      // Mock data on error
      setGaps([
        {
          id: "1",
          type: "missing-contact",
          title: "Missing CTO contact",
          description: "CTO mentioned in email but not in contacts",
          suggestion: "Add John Doe (john@company.com) as CTO",
          confidence: 85,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleApplySuggestion = (gap: Gap) => {
    // TODO: Apply the suggestion (add contact, update domain, etc.)
    console.log("Apply suggestion:", gap);
    setGaps((prev) => prev.filter((g) => g.id !== gap.id));
  };

  const handleDismiss = (gapId: string) => {
    setGaps((prev) => prev.filter((g) => g.id !== gapId));
  };

  if (loading) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        Analyzing coverage gaps...
      </div>
    );
  }

  if (gaps.length === 0) {
    return (
      <EmptyState
        icon={Sparkles}
        title="No gaps detected"
        description="Coverage looks good! All suggested contacts are in your system."
        actionLabel="Refresh"
        onAction={() => fetchGaps()}
      />
    );
  }

  return (
    <div className="space-y-3">
      {gaps.map((gap, index) => (
        <motion.div
          key={gap.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          className="p-4 rounded-lg border border-border bg-background hover:bg-accent/50 transition-colors"
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                {gap.type === "missing-contact" && <User className="h-4 w-4 text-primary" />}
                {gap.type === "domain-mismatch" && <Mail className="h-4 w-4 text-yellow-600" />}
                {gap.type === "alias-suggestion" && <Calendar className="h-4 w-4 text-blue-600" />}
                <h4 className="text-sm font-semibold text-foreground">
                  {gap.title}
                </h4>
                <Badge variant="outline" className="text-xs">
                  {gap.confidence}% confidence
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                {gap.description}
              </p>
              <div className="p-2 rounded bg-accent/50 border border-border">
                <p className="text-xs font-medium text-foreground mb-1">
                  Suggestion:
                </p>
                <p className="text-xs text-muted-foreground">
                  {gap.suggestion}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <Button
              variant="default"
              size="sm"
              onClick={() => handleApplySuggestion(gap)}
              className="text-xs h-7"
            >
              <Plus className="h-3 w-3 mr-1" />
              Apply
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDismiss(gap.id)}
              className="text-xs h-7"
            >
              Dismiss
            </Button>
          </div>
        </motion.div>
      ))}
    </div>
  );
}


