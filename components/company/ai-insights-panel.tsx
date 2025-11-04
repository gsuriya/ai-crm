"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  FileText,
  Users,
  TrendingUp,
  Building2,
  AlertTriangle,
  RefreshCw,
  GraduationCap,
  DollarSign,
  HelpCircle,
  Check,
  Clock,
  X,
} from "lucide-react";
import { motion } from "framer-motion";
import { EmptyState } from "./empty-state";

interface AIInsightsPanelProps {
  companyId: string;
}

interface AIInsight {
  id: string;
  type:
    | "one-minute-brief"
    | "warm-intros-map"
    | "thesis-fit-score"
    | "lookalike-graph"
    | "ghosting-risk"
    | "what-changed"
    | "diligence-accelerator"
    | "valuation-sanity";
  title: string;
  description: string;
  summary: string;
  actionable: boolean;
  confidence?: number;
  metadata?: Record<string, any>;
}

export function AIInsightsPanel({ companyId }: AIInsightsPanelProps) {
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedInsight, setExpandedInsight] = useState<string | null>(null);

  useEffect(() => {
    fetchInsights();
  }, [companyId]);

  const fetchInsights = async () => {
    try {
      setLoading(true);
      // Call AI endpoint for insights
      const response = await fetch(`/api/ai/insights?companyId=${companyId}`);
      if (response.ok) {
        const data = await response.json();
        setInsights(data.insights || []);
      } else {
        // Mock data for now
        setInsights([
          {
            id: "1",
            type: "one-minute-brief",
            title: "One-Minute Brief",
            description: "Quick summary of company status and key metrics",
            summary: "SaaS company with $10M ARR, 120% NRR, strong growth trajectory. Last touch: 12 days ago.",
            actionable: true,
            confidence: 95,
          },
          {
            id: "2",
            type: "warm-intros-map",
            title: "Warm Intros Map",
            description: "Map of warm introduction opportunities",
            summary: "3 warm intro opportunities: John Doe (LinkedIn), Jane Smith (Email), Bob Johnson (Mutual connection)",
            actionable: true,
            confidence: 85,
          },
          {
            id: "3",
            type: "thesis-fit-score",
            title: "Thesis Fit Score",
            description: "How well the company fits your investment thesis",
            summary: "Strong fit (85%): SaaS, SMB focus, B2B model aligns with portfolio. Geographic expansion potential.",
            actionable: true,
            confidence: 90,
          },
          {
            id: "4",
            type: "lookalike-graph",
            title: "Lookalike Graph",
            description: "Similar companies in your portfolio",
            summary: "Similar to 3 portfolio companies: Company A (85% match), Company B (78% match), Company C (72% match)",
            actionable: true,
            confidence: 80,
          },
          {
            id: "5",
            type: "ghosting-risk",
            title: "Ghosting Risk",
            description: "Risk of company going silent",
            summary: "Medium risk: No response to last 2 emails over 14 days. Consider re-engagement sequence.",
            actionable: true,
            confidence: 75,
          },
          {
            id: "6",
            type: "what-changed",
            title: "What Changed?",
            description: "Recent changes in company data and activity",
            summary: "Updated: ARR increased 15%, headcount grew 20%, new round announced. Last updated: 2 days ago.",
            actionable: true,
            confidence: 95,
          },
          {
            id: "7",
            type: "diligence-accelerator",
            title: "Diligence Accelerator",
            description: "AI-powered diligence checklist and recommendations",
            summary: "5 completed, 3 pending, 2 recommended: Customer references, financial audit, market analysis",
            actionable: true,
            confidence: 90,
          },
          {
            id: "8",
            type: "valuation-sanity",
            title: "Valuation Sanity Check",
            description: "Compare valuation to benchmarks and portfolio",
            summary: "Valuation: $50M. Benchmark: $45M-$55M. Portfolio average: $48M. Within range.",
            actionable: true,
            confidence: 85,
          },
        ]);
      }
    } catch (error) {
      console.error("Error fetching insights:", error);
      // Mock data on error
      setInsights([
        {
          id: "1",
          type: "one-minute-brief",
          title: "One-Minute Brief",
          description: "Quick summary of company status and key metrics",
          summary: "SaaS company with $10M ARR, 120% NRR, strong growth trajectory.",
          actionable: true,
          confidence: 95,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleExplain = (insight: AIInsight) => {
    // TODO: Show detailed explanation modal
    setExpandedInsight(expandedInsight === insight.id ? null : insight.id);
  };

  const handleApply = (insight: AIInsight) => {
    // TODO: Apply the insight action
    console.log("Apply insight:", insight);
  };

  const handleDismiss = (insightId: string) => {
    setInsights((prev) => prev.filter((i) => i.id !== insightId));
  };

  const handleOpenAsTask = (insight: AIInsight) => {
    // TODO: Create task from insight
    console.log("Open as task:", insight);
  };

  const getInsightIcon = (type: string) => {
    const icons: Record<string, any> = {
      "one-minute-brief": FileText,
      "warm-intros-map": Users,
      "thesis-fit-score": TrendingUp,
      "lookalike-graph": Building2,
      "ghosting-risk": AlertTriangle,
      "what-changed": RefreshCw,
      "diligence-accelerator": GraduationCap,
      "valuation-sanity": DollarSign,
    };
    return icons[type] || Sparkles;
  };

  if (loading) {
    return (
      <div className="text-sm text-muted-foreground text-center py-12">
        Loading AI insights...
      </div>
    );
  }

  if (insights.length === 0) {
    return (
      <EmptyState
        icon={Sparkles}
        title="No AI insights available"
        description="AI insights will appear here as we analyze company data."
        actionLabel="Refresh"
        onAction={() => fetchInsights()}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {insights.map((insight, index) => {
        const Icon = getInsightIcon(insight.type);
        const isExpanded = expandedInsight === insight.id;

        return (
          <motion.div
            key={insight.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="rounded-2xl shadow-sm border border-border p-5 hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 flex-1">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base font-semibold text-foreground">
                        {insight.title}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                        {insight.description}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDismiss(insight.id)}
                    className="h-6 w-6 p-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                {insight.confidence && (
                  <Badge variant="outline" className="text-xs">
                    {insight.confidence}% confidence
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Summary */}
                <div className="p-3 rounded-lg bg-accent/50 border border-border">
                  <p className="text-sm text-foreground">{insight.summary}</p>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="p-3 rounded-lg bg-muted/50 border border-border"
                  >
                    <p className="text-xs text-muted-foreground">
                      Detailed explanation of {insight.title} would appear here...
                    </p>
                    {insight.metadata && (
                      <div className="mt-2 space-y-1">
                        {Object.entries(insight.metadata).map(([key, value]) => (
                          <div key={key} className="text-xs">
                            <span className="font-medium text-foreground">{key}:</span>{" "}
                            <span className="text-muted-foreground">{String(value)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center gap-2 pt-3 border-t border-border">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExplain(insight)}
                    className="text-xs h-7 flex-1"
                  >
                    <HelpCircle className="h-3 w-3 mr-1" />
                    Explain
                  </Button>
                  {insight.actionable && (
                    <>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleApply(insight)}
                        className="text-xs h-7 flex-1"
                      >
                        <Check className="h-3 w-3 mr-1" />
                        Apply
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenAsTask(insight)}
                        className="text-xs h-7"
                      >
                        <Clock className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}


