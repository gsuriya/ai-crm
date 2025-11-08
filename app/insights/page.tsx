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
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600">Loading insights...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-background min-h-screen" style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
      {/* Header */}
      <div className="bg-background">
        <div className="max-w-7xl mx-auto px-8 pt-6 pb-2">
          <div className="mb-8 pt-0">
            <h1 className="text-2xl font-semibold text-gray-900 leading-6">Insights</h1>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1">
        <div className="max-w-7xl mx-auto px-8 pb-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Sourcing Funnel */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">Sourcing Funnel</h2>
                  <p className="text-xs text-gray-600 mt-1">
                    Outreach → Meeting → Follow-Up → Deal → Closed
                  </p>
                </div>
                <div className="p-6">
                  <FunnelView
                    filters={{
                      teamMember: "",
                      cadence: "",
                      channel: "",
                      dateRange: "all",
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Win/Lose Reasons */}
            <div>
              <div className="bg-white rounded-lg border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">Win/Lose Reasons</h2>
                </div>
                <div className="p-6">
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-900">Win Rate</span>
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
                        <span className="text-sm font-medium text-gray-900">Lose Rate</span>
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
                </div>
              </div>
            </div>

            {/* Relationship Coverage Heatmap */}
            <div className="lg:col-span-3">
              <div className="bg-white rounded-lg border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">Relationship Coverage Heatmap</h2>
                  <p className="text-xs text-gray-600 mt-1">
                    Coverage: {metrics.relationshipCoverage}%
                  </p>
                </div>
                <div className="p-6">
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
                </div>
              </div>
            </div>

            {/* Blind Spots */}
            <div className="lg:col-span-3">
              <div className="bg-white rounded-lg border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                    <h2 className="text-lg font-semibold text-gray-900">Blind Spots</h2>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    Companies with low relationship coverage
                  </p>
                </div>
                <div className="p-6">
                  <div className="space-y-4">
                    {[
                      { id: "1", company: "Company A", coverage: 15, reason: "No contacts" },
                      { id: "2", company: "Company B", coverage: 20, reason: "Low engagement" },
                    ].map((spot, index) => (
                      <div
                        key={spot.id}
                        className="flex items-center justify-between pb-4 border-b border-gray-100 last:border-0 last:pb-0"
                      >
                        <div className="flex-1">
                          <div className="text-base font-medium text-gray-900 mb-1">
                            {spot.company}
                          </div>
                          <div className="text-sm text-gray-600">
                            {spot.coverage}% coverage • {spot.reason}
                          </div>
                        </div>
                        <button className="text-sm text-indigo-600 hover:text-indigo-700 font-medium px-4 py-2 hover:bg-indigo-50 rounded-lg transition-colors">
                          Fix
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


