"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, DollarSign, Users, Plus, ExternalLink } from "lucide-react";
import { EmptyState } from "./empty-state";
import { motion } from "framer-motion";

interface Round {
  id: string;
  round_type: string;
  size: number;
  date: string;
  lead?: string;
  participants?: string[];
  source?: string;
  confidence?: number;
}

interface RoundsTimelineProps {
  rounds: Round[];
  companyId: string;
}

export function RoundsTimeline({ rounds, companyId }: RoundsTimelineProps) {
  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  if (rounds.length === 0) {
    return (
      <EmptyState
        icon={DollarSign}
        title="No funding rounds yet"
        description="Add funding rounds to track company financing history."
        actionLabel="Add Round"
        onAction={() => {
          // TODO: Open add round modal
        }}
      />
    );
  }

  // Sort rounds by date (newest first)
  const sortedRounds = [...rounds].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <div className="space-y-4">
      {sortedRounds.map((round, index) => (
        <motion.div
          key={round.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          className="relative pl-8 pb-6 border-l-2 border-border last:border-l-0 last:pb-0"
        >
          <div className="absolute left-0 top-0 -translate-x-1/2 w-4 h-4 rounded-full bg-primary border-2 border-background" />
          <div className="p-4 rounded-lg border border-border bg-background hover:bg-accent/50 transition-colors">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="default" className="text-xs">
                    {round.round_type}
                  </Badge>
                  <span className="text-lg font-semibold text-foreground">
                    {formatCurrency(round.size)}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span>{new Date(round.date).toLocaleDateString()}</span>
                  </div>
                  {round.lead && (
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      <span>Lead: {round.lead}</span>
                    </div>
                  )}
                  {round.confidence && (
                    <Badge variant="outline" className="text-xs">
                      {round.confidence}% confidence
                    </Badge>
                  )}
                </div>
                {round.participants && round.participants.length > 0 && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    <span className="font-medium">Participants:</span>{" "}
                    {round.participants.join(", ")}
                  </div>
                )}
                {round.source && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    <span className="font-medium">Source:</span> {round.source}
                  </div>
                )}
              </div>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}


