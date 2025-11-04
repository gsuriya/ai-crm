"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, X, HelpCircle } from "lucide-react";
import { motion } from "framer-motion";

interface RiskFlagsProps {
  companyId: string;
}

interface RiskFlag {
  id: string;
  type: "ghosting" | "icp-mismatch" | "data-staleness" | "founder-churn";
  title: string;
  description: string;
  severity: "high" | "medium" | "low";
  mitigation?: string;
}

export function RiskFlags({ companyId }: RiskFlagsProps) {
  const [flags, setFlags] = useState<RiskFlag[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRiskFlags();
  }, [companyId]);

  const fetchRiskFlags = async () => {
    try {
      setLoading(true);
      // Call AI endpoint for risk flags
      const response = await fetch(`/api/ai/ghosting-risk?companyId=${companyId}`);
      if (response.ok) {
        const data = await response.json();
        setFlags(data.flags || []);
      } else {
        // Mock data for now
        setFlags([
          {
            id: "1",
            type: "ghosting",
            title: "Ghosting risk",
            description: "No response to last 3 emails over 21 days",
            severity: "high",
            mitigation: "Consider re-engagement sequence or direct call",
          },
          {
            id: "2",
            type: "data-staleness",
            title: "Data staleness",
            description: "Financial data last updated 6 months ago",
            severity: "medium",
            mitigation: "Request updated metrics or enrich from public sources",
          },
        ]);
      }
    } catch (error) {
      console.error("Error fetching risk flags:", error);
      // Mock data on error
      setFlags([
        {
          id: "1",
          type: "ghosting",
          title: "Ghosting risk",
          description: "No response to last 3 emails over 21 days",
          severity: "high",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = (flagId: string) => {
    setFlags((prev) => prev.filter((f) => f.id !== flagId));
  };

  const handleExplain = (flag: RiskFlag) => {
    // TODO: Show detailed explanation modal
    console.log("Explain flag:", flag);
  };

  const getSeverityColor = (severity: string) => {
    const colors: Record<string, string> = {
      high: "bg-red-50 border-red-200 text-red-900",
      medium: "bg-yellow-50 border-yellow-200 text-yellow-900",
      low: "bg-blue-50 border-blue-200 text-blue-900",
    };
    return colors[severity] || colors.low;
  };

  if (loading) {
    return (
      <Card className="rounded-2xl shadow-sm border border-border p-5">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-16 bg-gray-200 rounded"></div>
        </div>
      </Card>
    );
  }

  if (flags.length === 0) {
    return null;
  }

  return (
    <Card className="rounded-2xl shadow-sm border border-border p-5">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <CardTitle className="text-lg font-semibold text-foreground">
            Risk Flags
          </CardTitle>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Signals & mitigation suggestions
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {flags.map((flag, index) => (
          <motion.div
            key={flag.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`p-3 rounded-lg border ${getSeverityColor(flag.severity)}`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-sm font-semibold text-foreground">
                    {flag.title}
                  </h4>
                  <Badge variant="outline" className="text-xs">
                    {flag.severity}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  {flag.description}
                </p>
                {flag.mitigation && (
                  <div className="mt-2 pt-2 border-t border-border">
                    <p className="text-xs font-medium text-foreground mb-1">
                      Mitigation:
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {flag.mitigation}
                    </p>
                  </div>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDismiss(flag.id)}
                className="ml-2 h-6 w-6 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExplain(flag)}
                className="text-xs h-7"
              >
                <HelpCircle className="h-3 w-3 mr-1" />
                Explain
              </Button>
            </div>
          </motion.div>
        ))}
      </CardContent>
    </Card>
  );
}


