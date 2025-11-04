"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import { useState, useEffect } from "react";
import type { FunnelStage } from "@/lib/types/pipeline";

interface FunnelViewProps {
  filters: {
    teamMember: string;
    cadence: string;
    channel: string;
    dateRange: string;
  };
}

export function FunnelView({ filters }: FunnelViewProps) {
  const [funnelData, setFunnelData] = useState<FunnelStage[]>([]);

  useEffect(() => {
    // Mock data - will be replaced with real API call
    const mockFunnel: FunnelStage[] = [
      { stage: 'outreach', count: 1200, conversionRate: 100 },
      { stage: 'meeting', count: 420, conversionRate: 35.0 },
      { stage: 'follow-up', count: 280, conversionRate: 66.7 },
      { stage: 'deal', count: 85, conversionRate: 30.4 },
      { stage: 'closed', count: 25, conversionRate: 29.4 },
    ];

    setFunnelData(mockFunnel);
  }, [filters]);

  const getStageLabel = (stage: string) => {
    const labels: Record<string, string> = {
      outreach: 'Outreach',
      meeting: 'Meeting',
      'follow-up': 'Follow-Up',
      deal: 'Deal',
      closed: 'Closed',
    };
    return labels[stage] || stage;
  };

  const getStageColor = (stage: string) => {
    const colors: Record<string, string> = {
      outreach: 'bg-blue-100 text-blue-800',
      meeting: 'bg-purple-100 text-purple-800',
      'follow-up': 'bg-yellow-100 text-yellow-800',
      deal: 'bg-orange-100 text-orange-800',
      closed: 'bg-green-100 text-green-800',
    };
    return colors[stage] || 'bg-gray-100 text-gray-800';
  };

  const maxCount = Math.max(...funnelData.map((s) => s.count));

  return (
    <Card className="rounded-2xl shadow-sm border border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground">
            Pipeline Funnel
          </CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Outreach → Meeting → Follow-Up → Deal → Closed
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {funnelData.map((stage, index) => {
            const widthPercent = (stage.count / maxCount) * 100;
            const prevStage = index > 0 ? funnelData[index - 1] : null;

            return (
              <div key={stage.stage} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">
                      {getStageLabel(stage.stage)}
                    </span>
                    {prevStage && stage.conversionRate && (
                      <span className="text-xs text-muted-foreground">
                        ({stage.conversionRate.toFixed(1)}% from {getStageLabel(prevStage.stage)})
                      </span>
                    )}
                  </div>
                  <span className="font-semibold text-foreground">
                    {stage.count.toLocaleString()}
                  </span>
                </div>
                <div className="relative h-8 bg-gray-100 rounded-lg overflow-hidden">
                  <div
                    className={`h-full ${getStageColor(stage.stage).split(' ')[0]} transition-all duration-500`}
                    style={{ width: `${widthPercent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}


