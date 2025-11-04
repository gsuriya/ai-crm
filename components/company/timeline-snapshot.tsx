"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, Phone, Calendar, FileText, Reply, PhoneCall, Plus } from "lucide-react";
import { EmptyState } from "./empty-state";
import type { ActivityItem } from "@/lib/types/company";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";

interface TimelineSnapshotProps {
  companyId: string;
  activities: ActivityItem[];
}

export function TimelineSnapshot({ companyId, activities }: TimelineSnapshotProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Keyboard navigation: J/K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "j" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, activities.length - 1));
      } else if (e.key === "k" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activities.length]);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "email":
        return Mail;
      case "call":
        return Phone;
      case "meeting":
        return Calendar;
      case "note":
        return FileText;
      default:
        return FileText;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case "email":
        return "bg-blue-100 text-blue-800";
      case "call":
        return "bg-purple-100 text-purple-800";
      case "meeting":
        return "bg-green-100 text-green-800";
      case "note":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  };

  // Group activities by day
  const groupedActivities = activities.reduce((acc, activity) => {
    const date = new Date(activity.date).toLocaleDateString();
    if (!acc[date]) acc[date] = [];
    acc[date].push(activity);
    return acc;
  }, {} as Record<string, ActivityItem[]>);

  if (activities.length === 0) {
    return (
      <Card className="rounded-2xl shadow-sm border border-border p-5">
        <EmptyState
          icon={Calendar}
          title="No recent activity"
          description="Get started by sending an email, scheduling a task, and more."
          actionLabel="Email CEO"
          onAction={() => {
            // TODO: Open email modal
            console.log("Email CEO");
          }}
        />
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl shadow-sm border border-border p-5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground">
            Timeline Snapshot
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            Last 5 activities
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {Object.entries(groupedActivities).map(([date, dayActivities]) => (
          <div key={date} className="space-y-3">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {formatDate(dayActivities[0].date)}
            </div>
            {dayActivities.map((activity) => {
              const Icon = getActivityIcon(activity.type);
              const isSelected = activities.indexOf(activity) === selectedIndex;

              return (
                <motion.div
                  key={activity.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-3 rounded-lg border border-border bg-background hover:bg-accent/50 transition-colors ${
                    isSelected ? "ring-2 ring-primary" : ""
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded ${getActivityColor(activity.type)}`}>
                        <Icon className="h-3 w-3" />
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {activity.type}
                      </Badge>
                      <span className="text-sm font-medium text-foreground">
                        {activity.summary}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(activity.date)}
                    </span>
                  </div>
                  {activity.body && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                      {activity.body.substring(0, 150)}
                      {activity.body.length > 150 ? "..." : ""}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    {activity.type === "email" && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs">
                        <Reply className="h-3 w-3 mr-1" />
                        Reply
                      </Button>
                    )}
                    {activity.type === "call" && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs">
                        <PhoneCall className="h-3 w-3 mr-1" />
                        Log Call
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="h-7 text-xs">
                      <Plus className="h-3 w-3 mr-1" />
                      Convert to Task
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}


