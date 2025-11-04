"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone, UserCheck, AlertCircle } from "lucide-react";
import type { PipelineMetrics } from "@/lib/types/pipeline";

interface VoiceCallStatsProps {
  metrics: PipelineMetrics;
}

export function VoiceCallStats({ metrics }: VoiceCallStatsProps) {
  const formatPercentage = (value: number) => `${value.toFixed(1)}%`;

  const stats = [
    {
      label: "Connect Rate",
      value: formatPercentage(metrics.voiceCallConnectRate),
      description: "Calls answered",
      icon: Phone,
      trend: "up",
    },
    {
      label: "Decision-Maker Connect",
      value: formatPercentage(metrics.voiceDecisionMakerRate),
      description: "Connected to decision maker",
      icon: UserCheck,
      trend: "neutral",
    },
    {
      label: "Drop-off Rate",
      value: formatPercentage(metrics.voiceDropoffRate),
      description: "Calls dropped before completion",
      icon: AlertCircle,
      trend: "down",
    },
  ];

  return (
    <Card className="rounded-2xl shadow-sm border border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold text-foreground">
          Voice AI Call Stats
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Based on call_logs data
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {stats.map((stat) => (
            <div key={stat.label} className="space-y-2">
              <div className="flex items-center gap-2">
                <stat.icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">
                  {stat.label}
                </span>
              </div>
              <div className="text-2xl font-semibold text-foreground">
                {stat.value}
              </div>
              <p className="text-xs text-muted-foreground">
                {stat.description}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}


