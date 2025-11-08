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
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600">Loading pipeline data...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-background min-h-screen" style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
      {/* Header */}
      <div className="bg-background">
        <div className="max-w-7xl mx-auto px-8 pt-6 pb-2">
          <div className="mb-8 pt-0">
            <h1 className="text-2xl font-semibold text-gray-900 leading-6">Pipeline</h1>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1">
        <div className="max-w-7xl mx-auto px-8 pb-6 space-y-6">
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
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Upcoming & Overdue Meetings
              </h2>
            </div>
            <div className="p-6">
              <MeetingsTable filters={filters} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


