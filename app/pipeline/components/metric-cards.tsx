"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Calendar, Phone, Users, Clock, ArrowUpRight } from "lucide-react";
import type { PipelineMetrics } from "@/lib/types/pipeline";
import { motion } from "framer-motion";

interface MetricCardsProps {
  metrics: PipelineMetrics;
}

export function MetricCards({ metrics }: MetricCardsProps) {
  const formatPercentage = (value: number) => `${value.toFixed(1)}%`;
  const formatDays = (value: number) => `${value.toFixed(1)} days`;

  const meetingsChange = metrics.bookedMeetings30d - metrics.bookedMeetings30dPrev;
  const meetingsChangePercent = metrics.bookedMeetings30dPrev > 0
    ? ((meetingsChange / metrics.bookedMeetings30dPrev) * 100).toFixed(1)
    : "0";

  const cards = [
    {
      title: "Booked Meetings (30d)",
      value: metrics.bookedMeetings30d,
      change: meetingsChange,
      changePercent: meetingsChangePercent,
      icon: Calendar,
      trend: meetingsChange >= 0 ? "up" : "down",
    },
    {
      title: "Response Rate",
      value: formatPercentage(metrics.responseRate),
      subtitle: "Emails + Voice AI",
      icon: ArrowUpRight,
    },
    {
      title: "Follow-Up Meetings",
      value: metrics.followUpMeetingsNext14d,
      subtitle: "Next 14 days",
      icon: Clock,
    },
    {
      title: "No-Show Rate",
      value: formatPercentage(metrics.noShowRate),
      icon: Users,
    },
    {
      title: "Pipeline Velocity",
      value: formatDays(metrics.pipelineVelocityDays),
      subtitle: "First meeting → Deal",
      icon: TrendingUp,
    },
    {
      title: "Voice Call Connect",
      value: formatPercentage(metrics.voiceCallConnectRate),
      icon: Phone,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {cards.map((card, index) => (
        <motion.div
          key={card.title}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
        >
          <Card className="rounded-2xl shadow-sm border border-border hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.title}
                </CardTitle>
                <card.icon className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold text-foreground">
                  {card.value}
                </span>
                {card.change !== undefined && (
                  <Badge
                    variant={card.trend === "up" ? "default" : "outline"}
                    className="flex items-center gap-1"
                  >
                    {card.trend === "up" ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    {Math.abs(card.changePercent)}%
                  </Badge>
                )}
              </div>
              {card.subtitle && (
                <p className="text-xs text-muted-foreground mt-1">
                  {card.subtitle}
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}


