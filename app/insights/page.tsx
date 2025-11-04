"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, TrendingUp, Users, Eye, AlertCircle } from "lucide-react";
import { FunnelView } from "@/app/pipeline/components/funnel-view";
import { TrendChart } from "@/app/pipeline/components/trend-chart";
import { motion } from "framer-motion";

export const dynamic = 'force-dynamic';

export default function InsightsPage() {
  const [metrics, setMetrics] = useState({
    sourcingFunnel: {} as Record<string, number>,
    winRate: 0,
    loseRate: 0,
    relationshipCoverage: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInsights();
  }, []);

  const fetchInsights = async () => {
    try {
      setLoading(true);
      // TODO: Fetch real insights data
      // Mock data for now
      setMetrics({
        sourcingFunnel: {
          outreach: 1200,
          meeting: 420,
          "follow-up": 280,
          deal: 85,
          closed: 25,
        },
        winRate: 65,
        loseRate: 35,
        relationshipCoverage: 75,
      });
    } catch (error) {
      console.error("Error fetching insights:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">Loading insights...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="max-w-7xl mx-auto px-6 py-5">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-semibold text-foreground">Insights</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Firm-level analytics & AI insights
          </p>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Sourcing Funnel */}
          <div className="col-span-12 lg:col-span-8">
            <Card className="rounded-2xl shadow-sm border border-border p-5">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold text-foreground">
                  Sourcing Funnel
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Outreach → Meeting → Follow-Up → Deal → Closed
                </p>
              </CardHeader>
              <CardContent>
                <FunnelView
                  filters={{
                    teamMember: "",
                    cadence: "",
                    channel: "",
                    dateRange: "all",
                  }}
                />
              </CardContent>
            </Card>
          </div>

          {/* Win/Lose Reasons */}
          <div className="col-span-12 lg:col-span-4">
            <Card className="rounded-2xl shadow-sm border border-border p-5">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold text-foreground">
                  Win/Lose Reasons
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-foreground">Win Rate</span>
                      <span className="text-sm font-semibold text-green-600">
                        {metrics.winRate}%
                      </span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500"
                        style={{ width: `${metrics.winRate}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-foreground">Lose Rate</span>
                      <span className="text-sm font-semibold text-red-600">
                        {metrics.loseRate}%
                      </span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-500"
                        style={{ width: `${metrics.loseRate}%` }}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Relationship Coverage Heatmap */}
          <div className="col-span-12">
            <Card className="rounded-2xl shadow-sm border border-border p-5">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold text-foreground">
                  Relationship Coverage Heatmap
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Coverage: {metrics.relationshipCoverage}%
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 md:grid-cols-8 lg:grid-cols-12 gap-2">
                  {Array.from({ length: 24 }).map((_, index) => {
                    const coverage = Math.random() * 100;
                    const color =
                      coverage > 75
                        ? "bg-green-500"
                        : coverage > 50
                        ? "bg-yellow-500"
                        : coverage > 25
                        ? "bg-orange-500"
                        : "bg-red-500";
                    return (
                      <div
                        key={index}
                        className={`aspect-square rounded ${color} hover:opacity-80 transition-opacity`}
                        title={`Company ${index + 1}: ${coverage.toFixed(0)}% coverage`}
                      />
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Blind Spots */}
          <div className="col-span-12">
            <Card className="rounded-2xl shadow-sm border border-border p-5">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <CardTitle className="text-lg font-semibold text-foreground">
                    Blind Spots
                  </CardTitle>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Companies with low relationship coverage
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[
                    { id: "1", company: "Company A", coverage: 15, reason: "No contacts" },
                    { id: "2", company: "Company B", coverage: 20, reason: "Low engagement" },
                  ].map((spot, index) => (
                    <motion.div
                      key={spot.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="p-3 rounded-lg bg-yellow-50 border border-yellow-200"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium text-foreground">
                            {spot.company}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {spot.coverage}% coverage • {spot.reason}
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" className="h-7 text-xs">
                          Fix
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}


