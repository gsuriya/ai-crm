"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Mail,
  Phone,
  Calendar,
  FileText,
  CheckSquare,
  Upload,
  Reply,
  PhoneCall,
  Plus,
  ArrowDown,
  ArrowUp,
} from "lucide-react";
import type { ActivityItem } from "@/lib/types/company";
import { EmailThread } from "./email-thread";
import { MeetingCard } from "./meeting-card";
import { EmptyState } from "./empty-state";
import { motion, AnimatePresence } from "framer-motion";

interface ActivityFeedProps {
  activities: ActivityItem[];
  companyId: string;
  selectedActivity: string | null;
  onSelectActivity: (id: string | null) => void;
}

export function ActivityFeed({
  activities,
  companyId,
  selectedActivity,
  onSelectActivity,
}: ActivityFeedProps) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [keyboardIndex, setKeyboardIndex] = useState(0);

  // Keyboard navigation: J/K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "j" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setKeyboardIndex((prev) => Math.min(prev + 1, activities.length - 1));
      } else if (e.key === "k" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setKeyboardIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        const activity = activities[keyboardIndex];
        if (activity) {
          const newExpanded = new Set(expandedItems);
          if (newExpanded.has(activity.id)) {
            newExpanded.delete(activity.id);
          } else {
            newExpanded.add(activity.id);
          }
          setExpandedItems(newExpanded);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activities, keyboardIndex, expandedItems]);

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
      case "task":
        return CheckSquare;
      case "upload":
        return Upload;
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
      case "task":
        return "bg-yellow-100 text-yellow-800";
      case "upload":
        return "bg-orange-100 text-orange-800";
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
      <EmptyState
        icon={Calendar}
        title="No activities yet"
        description="Get started by sending an email, scheduling a task, and more."
        actionLabel="Email CEO"
        onAction={() => {
          // TODO: Open email modal
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {Object.entries(groupedActivities).map(([date, dayActivities]) => (
        <div key={date} className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-border"></div>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-2">
              {formatDate(dayActivities[0].date)}
            </span>
            <div className="flex-1 h-px bg-border"></div>
          </div>
          {dayActivities.map((activity, index) => {
            const Icon = getActivityIcon(activity.type);
            const isExpanded = expandedItems.has(activity.id);
            const isSelected = activities.indexOf(activity) === keyboardIndex;

            return (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card
                  className={`rounded-lg border border-border hover:shadow-md transition-all cursor-pointer ${
                    isSelected ? "ring-2 ring-primary" : ""
                  }`}
                  onClick={() => {
                    const newExpanded = new Set(expandedItems);
                    if (newExpanded.has(activity.id)) {
                      newExpanded.delete(activity.id);
                    } else {
                      newExpanded.add(activity.id);
                    }
                    setExpandedItems(newExpanded);
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3 flex-1">
                        <div className={`p-2 rounded ${getActivityColor(activity.type)}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs">
                              {activity.type}
                            </Badge>
                            <span className="text-sm font-semibold text-foreground truncate">
                              {activity.summary}
                            </span>
                            {activity.sentiment && (
                              <Badge
                                variant={
                                  activity.sentiment === "positive"
                                    ? "default"
                                    : activity.sentiment === "negative"
                                    ? "destructive"
                                    : "outline"
                                }
                                className="text-xs"
                              >
                                {activity.sentiment}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(activity.date)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isExpanded ? (
                          <ArrowUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ArrowDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>

                    {activity.body && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                        {activity.body.substring(0, 200)}
                        {activity.body.length > 200 ? "..." : ""}
                      </p>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
                      {activity.type === "email" && (
                        <>
                          <Button variant="ghost" size="sm" className="h-7 text-xs">
                            <Reply className="h-3 w-3 mr-1" />
                            Reply
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 text-xs">
                            <Plus className="h-3 w-3 mr-1" />
                            Convert to Task
                          </Button>
                        </>
                      )}
                      {activity.type === "call" && (
                        <Button variant="ghost" size="sm" className="h-7 text-xs">
                          <PhoneCall className="h-3 w-3 mr-1" />
                          Log Call
                        </Button>
                      )}
                    </div>

                    {/* Expanded Content */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-4 pt-4 border-t border-border"
                        >
                          {activity.type === "email" && (
                            <EmailThread activityId={activity.id} companyId={companyId} />
                          )}
                          {activity.type === "meeting" && (
                            <MeetingCard activityId={activity.id} companyId={companyId} />
                          )}
                          {activity.type === "call" && activity.body && (
                            <div className="p-3 rounded-lg bg-muted/50">
                              <p className="text-sm text-foreground whitespace-pre-wrap">
                                {activity.body}
                              </p>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      ))}
    </div>
  );
}


