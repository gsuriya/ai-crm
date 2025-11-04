"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { PipelineMetrics } from "@/lib/types/pipeline";
import { MetricCards } from "./components/metric-cards";
import { TrendChart } from "./components/trend-chart";
import { FunnelView } from "./components/funnel-view";
import { VoiceCallStats } from "./components/voice-call-stats";
import { InsightsPanel } from "./components/insights-panel";
import { MeetingsTable } from "./components/meetings-table";
import { PipelineFilters } from "./components/pipeline-filters";
import { EmptyState } from "@/components/company/empty-state";
import { Calendar } from "lucide-react";

export const dynamic = 'force-dynamic';

export default function PipelinePage() {
  const [metrics, setMetrics] = useState<PipelineMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    teamMember: "",
    cadence: "",
    channel: "",
    dateRange: "90d",
  });

  useEffect(() => {
    fetchPipelineMetrics();
  }, [filters]);

  const fetchPipelineMetrics = async () => {
    try {
      setLoading(true);
      
      // Calculate metrics from existing data
      // This is a placeholder - will be replaced with real calculations
      const mockMetrics: PipelineMetrics = {
        bookedMeetings30d: 42,
        bookedMeetings30dPrev: 38,
        responseRate: 28.5,
        followUpMeetingsNext14d: 12,
        noShowRate: 8.2,
        pipelineVelocityDays: 14.5,
        voiceCallConnectRate: 65.3,
        voiceDecisionMakerRate: 18.2,
        voiceDropoffRate: 12.5,
      };

      setMetrics(mockMetrics);
    } catch (error) {
      console.error("Error fetching pipeline metrics:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">Loading pipeline data...</div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border bg-background px-6 py-5">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-semibold text-foreground">Pipeline</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Firm-level and company-level pipeline analytics
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Metric Cards */}
          {metrics && <MetricCards metrics={metrics} />}

          {/* Filters */}
          <PipelineFilters filters={filters} onFiltersChange={setFilters} />

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TrendChart filters={filters} />
            <FunnelView filters={filters} />
          </div>

          {/* Voice Call Stats */}
          {metrics && <VoiceCallStats metrics={metrics} />}

          {/* AI Insights */}
          <InsightsPanel filters={filters} />

          {/* Meetings Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-border p-5">
            <h2 className="text-lg font-semibold text-foreground mb-4">
              Upcoming & Overdue Meetings
            </h2>
            <MeetingsTable filters={filters} />
          </div>
        </div>
      </div>
    </div>
  );
}


