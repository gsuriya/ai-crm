"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DollarSign, TrendingUp, Clock, Users, FileText, ExternalLink } from "lucide-react";
import { EmptyState } from "./empty-state";
import { Plus } from "lucide-react";

interface CompanyKeyMetricsProps {
  companyId: string;
}

interface FinancialData {
  arr?: number;
  growth?: number;
  burn?: number;
  runway?: number;
  headcount?: number;
  lastRound?: {
    size: number;
    date: string;
    lead: string;
  };
  lastUpdated?: string;
}

export function CompanyKeyMetrics({ companyId }: CompanyKeyMetricsProps) {
  const [metrics, setMetrics] = useState<FinancialData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
  }, [companyId]);

  const fetchMetrics = async () => {
    try {
      setLoading(true);

      // Fetch financials
      const { data: financials } = await supabase
        .from("company_financials")
        .select("*")
        .eq("company_id", companyId)
        .order("year", { ascending: false })
        .limit(1);

      if (financials && financials.length > 0) {
        const latest = financials[0];
        setMetrics({
          arr: latest.arr,
          growth: undefined, // Calculate from previous year
          burn: undefined,
          runway: undefined,
          headcount: undefined,
          lastUpdated: latest.updated_at,
        });
      } else {
        setMetrics(null);
      }
    } catch (error) {
      console.error("Error fetching metrics:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="rounded-2xl shadow-sm border border-border p-5">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="h-8 bg-gray-200 rounded w-1/2"></div>
        </div>
      </Card>
    );
  }

  if (!metrics || !metrics.arr) {
    return (
      <Card className="rounded-2xl shadow-sm border border-border p-5">
        <EmptyState
          icon={DollarSign}
          title="No metrics yet"
          description="No metrics yet — add ARR, burn, or fundraise to unlock growth charts."
          actionLabel="Add Financials"
          onAction={() => {
            // TODO: Open financials modal
            console.log("Open financials modal");
          }}
        />
      </Card>
    );
  }

  const formatCurrency = (value?: number) => {
    if (!value) return "—";
    if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  return (
    <Card className="rounded-2xl shadow-sm border border-border p-5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground">
            Key Metrics
          </CardTitle>
          {metrics.lastUpdated && (
            <Badge variant="outline" className="text-xs">
              Updated {new Date(metrics.lastUpdated).toLocaleDateString()}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <DollarSign className="h-4 w-4" />
              <span>ARR</span>
            </div>
            <div className="text-xl font-semibold text-foreground">
              {formatCurrency(metrics.arr)}
            </div>
          </div>
          {metrics.growth !== undefined && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
                <span>Growth</span>
              </div>
              <div className="text-xl font-semibold text-foreground">
                {metrics.growth.toFixed(1)}%
              </div>
            </div>
          )}
          {metrics.burn !== undefined && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
                <span>Burn</span>
              </div>
              <div className="text-xl font-semibold text-foreground">
                {formatCurrency(metrics.burn)}
              </div>
            </div>
          )}
          {metrics.runway !== undefined && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Runway</span>
              </div>
              <div className="text-xl font-semibold text-foreground">
                {metrics.runway} months
              </div>
            </div>
          )}
          {metrics.headcount !== undefined && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>Headcount</span>
              </div>
              <div className="text-xl font-semibold text-foreground">
                {metrics.headcount}
              </div>
            </div>
          )}
        </div>

        {metrics.lastRound && (
          <div className="pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-foreground">
                  Last Round
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {formatCurrency(metrics.lastRound.size)} • {new Date(metrics.lastRound.date).toLocaleDateString()} • Lead: {metrics.lastRound.lead}
                </div>
              </div>
              <Button variant="ghost" size="sm">
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-border">
          <Button variant="outline" size="sm" className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Add Metrics
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}


