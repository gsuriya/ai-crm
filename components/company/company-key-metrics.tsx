"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DollarSign, TrendingUp, Clock, Users, FileText, ExternalLink, ChevronRight } from "lucide-react";
import { EmptyState } from "./empty-state";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface CompanyKeyMetricsProps {
  companyId: string;
}

interface FinancialData {
  arr?: number;
  gross_retention?: number;
  net_retention?: number;
  growth?: number;
  burn?: number;
  runway?: number;
  headcount?: number;
  month?: number;
  year?: number;
  isLive?: boolean; // True if data is from current month/year
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
  const [allFinancials, setAllFinancials] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    fetchMetrics();
  }, [companyId]);

  const fetchMetrics = async () => {
    try {
      setLoading(true);

      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;

      // Fetch financials - prioritize by month/year, then by year
      const { data: financials } = await supabase
        .from("company_financials")
        .select("*")
        .eq("company_id", companyId)
        .order("year", { ascending: false })
        .order("month", { ascending: false, nullsFirst: false });

      if (financials && financials.length > 0) {
        // Sort by year and month for display
        const sortedFinancials = [...financials].sort((a, b) => {
          if (a.year !== b.year) return b.year - a.year;
          return (b.month || 0) - (a.month || 0);
        });
        
        setAllFinancials(sortedFinancials);
        
        // Find the most recent financial data (with month if available, otherwise yearly)
        const latest = sortedFinancials[0];
        const isLive = latest.year === currentYear && 
          (latest.month === null || latest.month === currentMonth);

        // Calculate growth from previous period if available
        let growth: number | undefined = undefined;
        if (sortedFinancials.length > 1 && latest.arr) {
          const previous = sortedFinancials[1];
          if (previous.arr && previous.arr > 0) {
            growth = ((latest.arr - previous.arr) / previous.arr) * 100;
          }
        }

        setMetrics({
          arr: latest.arr,
          gross_retention: latest.gross_retention,
          net_retention: latest.net_retention,
          growth,
          burn: undefined,
          runway: undefined,
          headcount: undefined,
          month: latest.month,
          year: latest.year,
          isLive,
          lastUpdated: latest.updated_at,
        });
      } else {
        setMetrics(null);
        setAllFinancials([]);
      }
    } catch (error) {
      console.error("Error fetching metrics:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-5 bg-muted rounded w-1/4"></div>
          <div className="h-8 bg-muted rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (!metrics || !metrics.arr) {
    return (
      <div className="py-8">
        <EmptyState
          icon={DollarSign}
          title="No metrics yet"
          description="Add ARR, burn, or fundraise to unlock growth charts."
          actionLabel="Add Financials"
          onAction={() => {
            // TODO: Open financials modal
            console.log("Open financials modal");
          }}
        />
      </div>
    );
  }

  const formatCurrency = (value?: number) => {
    if (!value) return "—";
    if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  // Prepare chart data if we have multiple data points
  const chartData = allFinancials.length > 1 
    ? allFinancials
        .filter(f => f.arr)
        .reverse()
        .map(f => ({
          period: f.month ? `${f.year}-${String(f.month).padStart(2, '0')}` : f.year.toString(),
          arr: f.arr || 0,
        }))
    : [];

  return (
    <div 
      className={`py-6 ${metrics && metrics.arr ? 'cursor-pointer' : ''}`}
      onClick={() => metrics && metrics.arr && router.push(`/companies/${companyId}/financials`)}
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold text-foreground">
            Financials
          </h2>
          {metrics && metrics.arr && (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        <div className="flex items-center gap-2">
          {metrics && metrics.isLive && (
            <Badge variant="default" className="text-xs bg-green-500">
              Live
            </Badge>
          )}
          {metrics && metrics.month && metrics.year && (
            <Badge variant="outline" className="text-xs">
              {new Date(metrics.year, metrics.month - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            </Badge>
          )}
          {metrics && !metrics.month && metrics.year && (
            <Badge variant="outline" className="text-xs">
              {metrics.year}
            </Badge>
          )}
          {metrics && metrics.lastUpdated && (
            <Badge variant="outline" className="text-xs">
              Updated {new Date(metrics.lastUpdated).toLocaleDateString()}
            </Badge>
          )}
        </div>
      </div>
      <div className="space-y-6">
        {/* Show chart if we have multiple data points */}
        {chartData.length > 1 && (
          <div className="h-64 mb-6">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="period"
                  stroke="#6b7280"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#6b7280"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => formatCurrency(value)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                  }}
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Area
                  type="monotone"
                  dataKey="arr"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.2}
                  name="ARR"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
        
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <DollarSign className="h-4 w-4" />
              <span>ARR</span>
            </div>
            <div className="text-xl font-semibold text-foreground">
              {formatCurrency(metrics?.arr)}
            </div>
          </div>
          {metrics && metrics.gross_retention !== undefined && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
                <span>Gross Retention</span>
              </div>
              <div className="text-xl font-semibold text-foreground">
                {metrics.gross_retention.toFixed(1)}%
              </div>
            </div>
          )}
          {metrics && metrics.net_retention !== undefined && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
                <span>Net Retention</span>
              </div>
              <div className="text-xl font-semibold text-foreground">
                {metrics.net_retention.toFixed(1)}%
              </div>
            </div>
          )}
          {metrics && metrics.growth !== undefined && (
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
          {metrics && metrics.burn !== undefined && (
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
          {metrics && metrics.runway !== undefined && (
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
          {metrics && metrics.headcount !== undefined && (
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

        {metrics && metrics.lastRound && (
          <div className="pt-6 border-t border-border/50">
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

        <div className="pt-6 border-t border-border/50">
          <Button variant="outline" size="sm" className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Add Metrics
          </Button>
        </div>
      </div>
    </div>
  );
}


