"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, HelpCircle, Check, X } from "lucide-react";
import { useState, useEffect } from "react";
import type { PipelineInsight } from "@/lib/types/pipeline";

interface InsightsPanelProps {
  filters: {
    teamMember: string;
    cadence: string;
    channel: string;
    dateRange: string;
  };
}

export function InsightsPanel({ filters }: InsightsPanelProps) {
  const [insights, setInsights] = useState<PipelineInsight[]>([]);

  useEffect(() => {
    // Mock insights - will be replaced with real AI insights
    const mockInsights: PipelineInsight[] = [
      {
        id: "1",
        type: "cadence-performance",
        title: "Cadence X has 28% response rate",
        description: "Your benchmark is 35%. Consider A/B testing subject lines or adjusting send times.",
        severity: "warning",
        actionable: true,
        actionLabel: "Optimize Cadence",
        benchmark: 35,
        current: 28,
      },
      {
        id: "2",
        type: "call-optimization",
        title: "Voice AI calls had 18% decision-maker connect rate",
        description: "Consider call time adjustment. Decision-makers are more likely to answer between 2-4 PM.",
        severity: "info",
        actionable: true,
        actionLabel: "Adjust Call Times",
        benchmark: 25,
        current: 18,
      },
      {
        id: "3",
        type: "follow-up-timing",
        title: "Follow-up meetings within 3 days convert 2× more",
        description: "Companies with follow-ups scheduled within 3 days of first meeting have 2× conversion rate.",
        severity: "info",
        actionable: true,
        actionLabel: "Schedule Follow-ups",
      },
    ];

    setInsights(mockInsights);
  }, [filters]);

  const getSeverityColor = (severity: string) => {
    const colors: Record<string, string> = {
      info: "bg-blue-50 border-blue-200",
      warning: "bg-yellow-50 border-yellow-200",
      critical: "bg-red-50 border-red-200",
    };
    return colors[severity] || colors.info;
  };

  const handleExplain = (insight: PipelineInsight) => {
    // TODO: Show detailed explanation modal
    console.log("Explain insight:", insight);
  };

  const handleApply = (insight: PipelineInsight) => {
    // TODO: Apply the insight action
    console.log("Apply insight:", insight);
  };

  const handleDismiss = (insightId: string) => {
    setInsights((prev) => prev.filter((i) => i.id !== insightId));
  };

  if (insights.length === 0) {
    return null;
  }

  return (
    <Card className="rounded-2xl shadow-sm border border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg font-semibold text-foreground">
            AI Insights
          </CardTitle>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Actionable suggestions to improve pipeline performance
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {insights.map((insight) => (
            <div
              key={insight.id}
              className={`p-4 rounded-lg border ${getSeverityColor(insight.severity)}`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-foreground">
                      {insight.title}
                    </h4>
                    <Badge variant="outline" className="text-xs">
                      {insight.severity}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {insight.description}
                  </p>
                  {insight.benchmark && insight.current && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      Current: {insight.current}% | Benchmark: {insight.benchmark}%
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDismiss(insight.id)}
                  className="ml-2"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExplain(insight)}
                  className="text-xs"
                >
                  <HelpCircle className="h-3 w-3 mr-1" />
                  Explain
                </Button>
                {insight.actionable && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleApply(insight)}
                    className="text-xs"
                  >
                    <Check className="h-3 w-3 mr-1" />
                    {insight.actionLabel || "Apply"}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}


