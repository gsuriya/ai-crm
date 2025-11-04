"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "next/link";
import { Briefcase, Clock, AlertCircle, ArrowRight } from "lucide-react";
import type { Deal } from "@/lib/types/company";

interface DealStateProps {
  deal: Deal;
}

export function DealState({ deal }: DealStateProps) {
  const getStageColor = (stage: string) => {
    const colors: Record<string, string> = {
      prospecting: "bg-blue-100 text-blue-800",
      qualification: "bg-yellow-100 text-yellow-800",
      proposal: "bg-orange-100 text-orange-800",
      negotiation: "bg-purple-100 text-purple-800",
      closed_won: "bg-green-100 text-green-800",
      closed_lost: "bg-red-100 text-red-800",
    };
    return colors[stage] || "bg-gray-100 text-gray-800";
  };

  const formatStage = (stage: string) => {
    return stage
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  return (
    <Card className="rounded-2xl shadow-sm border border-border p-5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-primary" />
            <CardTitle className="text-lg font-semibold text-foreground">
              Deal State
            </CardTitle>
          </div>
          <Link href="/pipeline">
            <Button variant="ghost" size="sm">
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Stage</span>
            <Badge className={getStageColor(deal.stage)}>
              {formatStage(deal.stage)}
            </Badge>
          </div>
          {deal.amount && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Amount</span>
              <span className="text-sm font-semibold text-foreground">
                ${(deal.amount / 1000).toFixed(0)}K
              </span>
            </div>
          )}
          {deal.probability !== undefined && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Probability</span>
              <span className="text-sm font-semibold text-foreground">
                {deal.probability}%
              </span>
            </div>
          )}
          {deal.closeDate && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Close Date</span>
              <span className="text-sm font-semibold text-foreground">
                {new Date(deal.closeDate).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>

        {deal.blockers && deal.blockers.length > 0 && (
          <div className="pt-4 border-t border-border">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
              <div className="flex-1">
                <div className="text-sm font-medium text-foreground mb-1">
                  Blockers
                </div>
                <ul className="text-xs text-muted-foreground space-y-1">
                  {deal.blockers.map((blocker, idx) => (
                    <li key={idx}>• {blocker}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-border">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>SLA: 14 days in current stage</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


