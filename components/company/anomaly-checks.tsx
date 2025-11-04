"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, Sparkles, HelpCircle } from "lucide-react";
import { EmptyState } from "./empty-state";
import { motion } from "framer-motion";

interface FinancialData {
  id: string;
  company_id: string;
  year: number;
  arr?: number;
  gross_retention?: number;
  net_retention?: number;
  gross_margin?: number;
  ebitda?: number;
  created_at: string;
  updated_at: string;
}

interface AnomalyCheck {
  id: string;
  type: "warning" | "error" | "info";
  title: string;
  description: string;
  metric: string;
  value: number;
  benchmark: number;
  recommendation?: string;
}

interface AnomalyChecksProps {
  financials: FinancialData[];
  companyId: string;
}

export function AnomalyChecks({ financials, companyId }: AnomalyChecksProps) {
  const [anomalies, setAnomalies] = useState<AnomalyCheck[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnomalies();
  }, [financials, companyId]);

  const fetchAnomalies = async () => {
    try {
      setLoading(true);
      // Call AI endpoint for anomaly detection
      const response = await fetch(`/api/ai/anomaly-checks?companyId=${companyId}`);
      if (response.ok) {
        const data = await response.json();
        setAnomalies(data.anomalies || []);
      } else {
        // Mock data for now
        if (financials.length > 0) {
          const latest = financials.sort((a, b) => b.year - a.year)[0];
          const mockAnomalies: AnomalyCheck[] = [];

          if (latest.gross_retention && latest.gross_retention < 90) {
            mockAnomalies.push({
              id: "1",
              type: "warning",
              title: "Low Gross Retention",
              description: "Gross retention is below industry benchmark (90%)",
              metric: "Gross Retention",
              value: latest.gross_retention,
              benchmark: 90,
              recommendation: "Investigate churn reasons and improve retention strategies",
            });
          }

          if (latest.net_retention && latest.net_retention < 100) {
            mockAnomalies.push({
              id: "2",
              type: "info",
              title: "Net Retention Below 100%",
              description: "Net retention is below 100%, indicating contraction",
              metric: "Net Retention",
              value: latest.net_retention,
              benchmark: 100,
              recommendation: "Focus on expansion revenue and upselling",
            });
          }

          if (latest.gross_margin && latest.gross_margin < 70) {
            mockAnomalies.push({
              id: "3",
              type: "warning",
              title: "Low Gross Margin",
              description: "Gross margin is below SaaS benchmark (70%)",
              metric: "Gross Margin",
              value: latest.gross_margin,
              benchmark: 70,
              recommendation: "Review pricing and cost structure",
            });
          }

          setAnomalies(mockAnomalies);
        }
      }
    } catch (error) {
      console.error("Error fetching anomalies:", error);
      setAnomalies([]);
    } finally {
      setLoading(false);
    }
  };

  const getAnomalyIcon = (type: string) => {
    switch (type) {
      case "error":
        return AlertTriangle;
      case "warning":
        return AlertTriangle;
      case "info":
        return CheckCircle;
      default:
        return AlertTriangle;
    }
  };

  const getAnomalyColor = (type: string) => {
    switch (type) {
      case "error":
        return "bg-red-50 border-red-200 text-red-900";
      case "warning":
        return "bg-yellow-50 border-yellow-200 text-yellow-900";
      case "info":
        return "bg-blue-50 border-blue-200 text-blue-900";
      default:
        return "bg-gray-50 border-gray-200 text-gray-900";
    }
  };

  if (loading) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        Analyzing anomalies...
      </div>
    );
  }

  if (anomalies.length === 0) {
    return (
      <EmptyState
        icon={CheckCircle}
        title="No anomalies detected"
        description="All metrics are within expected ranges."
        actionLabel="Refresh"
        onAction={() => fetchAnomalies()}
      />
    );
  }

  return (
    <div className="space-y-3">
      {anomalies.map((anomaly, index) => {
        const Icon = getAnomalyIcon(anomaly.type);

        return (
          <motion.div
            key={anomaly.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`p-3 rounded-lg border ${getAnomalyColor(anomaly.type)}`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2 flex-1">
                <Icon className="h-4 w-4 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-foreground">
                    {anomaly.title}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    {anomaly.description}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="text-xs">
                {anomaly.type}
              </Badge>
            </div>
            <div className="mt-2 pt-2 border-t border-border">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">{anomaly.metric}:</span>
                <span className="font-semibold text-foreground">
                  {anomaly.value}% (Benchmark: {anomaly.benchmark}%)
                </span>
              </div>
              {anomaly.recommendation && (
                <div className="mt-2 p-2 rounded bg-background/50 border border-border">
                  <div className="flex items-start gap-2">
                    <Sparkles className="h-3 w-3 text-primary mt-0.5" />
                    <p className="text-xs text-muted-foreground">
                      {anomaly.recommendation}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}


