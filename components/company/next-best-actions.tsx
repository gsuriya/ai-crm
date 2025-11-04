"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, HelpCircle, Check, Clock } from "lucide-react";
import { motion } from "framer-motion";

interface NextBestActionsProps {
  companyId: string;
}

interface Action {
  id: string;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  actionType: "email" | "call" | "task" | "note";
}

export function NextBestActions({ companyId }: NextBestActionsProps) {
  const [actions, setActions] = useState<Action[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNextActions();
  }, [companyId]);

  const fetchNextActions = async () => {
    try {
      setLoading(true);
      // Call AI endpoint for next best actions
      const response = await fetch(`/api/ai/next-actions?companyId=${companyId}`);
      if (response.ok) {
        const data = await response.json();
        setActions(data.actions || []);
      } else {
        // Mock data for now
        setActions([
          {
            id: "1",
            title: "CEO replied 12d ago — draft follow-up",
            description: "Last email was sent 12 days ago. Consider sending a follow-up to maintain engagement.",
            priority: "high",
            actionType: "email",
          },
          {
            id: "2",
            title: "No cadence on CTO — assign?",
            description: "CTO contact has no active cadence. Consider adding them to a warm outreach sequence.",
            priority: "medium",
            actionType: "task",
          },
        ]);
      }
    } catch (error) {
      console.error("Error fetching next actions:", error);
      // Mock data on error
      setActions([
        {
          id: "1",
          title: "CEO replied 12d ago — draft follow-up",
          description: "Last email was sent 12 days ago. Consider sending a follow-up to maintain engagement.",
          priority: "high",
          actionType: "email",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleExplain = (action: Action) => {
    // TODO: Show detailed explanation modal
    console.log("Explain action:", action);
  };

  const handleDoIt = (action: Action) => {
    // TODO: Execute the action
    console.log("Do action:", action);
  };

  const handleSnooze = (actionId: string) => {
    setActions((prev) => prev.filter((a) => a.id !== actionId));
    // TODO: Snooze action for later
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      high: "bg-red-100 text-red-800",
      medium: "bg-yellow-100 text-yellow-800",
      low: "bg-blue-100 text-blue-800",
    };
    return colors[priority] || colors.low;
  };

  if (loading) {
    return (
      <Card className="rounded-2xl shadow-sm border border-border p-5">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
        </div>
      </Card>
    );
  }

  if (actions.length === 0) {
    return (
      <Card className="rounded-2xl shadow-sm border border-border p-5">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <CardTitle className="text-lg font-semibold text-foreground">
              Next Best Actions
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground text-center py-4">
            No actions available at this time.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl shadow-sm border border-border p-5">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <CardTitle className="text-lg font-semibold text-foreground">
            Next Best Actions
          </CardTitle>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Ranked AI suggestions
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {actions.map((action, index) => (
          <motion.div
            key={action.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="p-3 rounded-lg border border-border bg-background hover:bg-accent/50 transition-colors"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-sm font-semibold text-foreground">
                    {action.title}
                  </h4>
                  <Badge className={getPriorityColor(action.priority)} variant="outline">
                    {action.priority}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {action.description}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleExplain(action)}
                className="text-xs h-7"
              >
                <HelpCircle className="h-3 w-3 mr-1" />
                Explain
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => handleDoIt(action)}
                className="text-xs h-7"
              >
                <Check className="h-3 w-3 mr-1" />
                Do it
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleSnooze(action.id)}
                className="text-xs h-7"
              >
                <Clock className="h-3 w-3 mr-1" />
                Snooze
              </Button>
            </div>
          </motion.div>
        ))}
      </CardContent>
    </Card>
  );
}


