"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, Phone, Calendar, FileText, Reply, PhoneCall, Plus, ChevronRight, ExternalLink } from "lucide-react";
import { EmptyState } from "./empty-state";
import type { ActivityItem } from "@/lib/types/company";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface TimelineSnapshotProps {
  companyId: string;
  activities: ActivityItem[];
}

export function TimelineSnapshot({ companyId, activities }: TimelineSnapshotProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedActivity, setSelectedActivity] = useState<ActivityItem | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const router = useRouter();

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
        return "bg-indigo-500 text-white";
      case "call":
        return "bg-purple-500 text-white";
      case "meeting":
        return "bg-emerald-500 text-white";
      case "note":
        return "bg-slate-600 text-white";
      default:
        return "bg-slate-600 text-white";
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
      <Card className="rounded-2xl shadow-sm border-2 border-border p-4">
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
    <>
      <Card 
        className="rounded-2xl shadow-sm border-2 border-border p-5 cursor-pointer hover:border-primary/50 transition-colors"
        onClick={() => router.push(`/companies/${companyId}/activity`)}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg font-semibold text-foreground">
                Call Logs
              </CardTitle>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
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
                  className={`p-3 rounded-lg border-2 border-border bg-background hover:bg-accent/50 transition-colors cursor-pointer ${
                    isSelected ? "ring-2 ring-primary" : ""
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedActivity(activity);
                    setIsDialogOpen(true);
                  }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2 flex-1">
                      <div className={`p-1.5 rounded ${getActivityColor(activity.type)}`}>
                        <Icon className="h-3 w-3" />
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {activity.type === 'email' && (activity as any).metadata?.direction === 'sent' 
                          ? 'Sent Email' 
                          : activity.type === 'email' && (activity as any).metadata?.direction === 'received'
                          ? 'Received Email'
                          : activity.type}
                      </Badge>
                      <span className="text-sm font-medium text-foreground flex-1">
                        {activity.summary}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                      {formatDate(activity.date)}
                    </span>
                  </div>
                  {activity.type === 'email' && (activity as any).metadata?.from_email && (
                    <div className="text-xs text-muted-foreground mb-1">
                      {(activity as any).metadata.direction === 'sent' 
                        ? `To: ${(activity as any).metadata.to_email}`
                        : `From: ${(activity as any).metadata.from_email}`}
                    </div>
                  )}
                  {activity.type === 'call' && (activity as any).metadata?.duration && (
                    <div className="text-xs text-muted-foreground mb-1">
                      Duration: {Math.floor((activity as any).metadata.duration / 60)}m {((activity as any).metadata.duration % 60)}s
                      {(activity as any).metadata.has_summary && ' • Summary available'}
                    </div>
                  )}
                  {activity.body && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                      {activity.type === 'call' && (activity as any).metadata?.has_summary
                        ? activity.body // Show summary for calls
                        : activity.body.substring(0, 150) + (activity.body.length > 150 ? "..." : "")}
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

    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {selectedActivity && (() => {
              const Icon = getActivityIcon(selectedActivity.type);
              return (
                <>
                  <div className={`p-2 rounded ${getActivityColor(selectedActivity.type)}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span>
                    {selectedActivity.type === 'email' && (selectedActivity as any).metadata?.direction === 'sent' 
                      ? 'Sent Email' 
                      : selectedActivity.type === 'email' && (selectedActivity as any).metadata?.direction === 'received'
                      ? 'Received Email'
                      : selectedActivity.type === 'call'
                      ? 'Voice Call'
                      : selectedActivity.type}
                  </span>
                </>
              );
            })()}
          </DialogTitle>
          <DialogDescription>
            {selectedActivity && formatDate(selectedActivity.date)}
          </DialogDescription>
        </DialogHeader>
        {selectedActivity && (
          <div className="space-y-4 mt-4">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">Summary</h3>
              <p className="text-sm text-foreground">{selectedActivity.summary}</p>
            </div>
            {selectedActivity.type === 'email' && (selectedActivity as any).metadata && (
              <div className="space-y-2">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">From</h3>
                  <p className="text-sm text-foreground">{(selectedActivity as any).metadata.from_email}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">To</h3>
                  <p className="text-sm text-foreground">{(selectedActivity as any).metadata.to_email}</p>
                </div>
              </div>
            )}
            {selectedActivity.type === 'call' && (selectedActivity as any).metadata && (
              <div className="space-y-2">
                {(selectedActivity as any).metadata.duration && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Duration</h3>
                    <p className="text-sm text-foreground">
                      {Math.floor((selectedActivity as any).metadata.duration / 60)}m {((selectedActivity as any).metadata.duration % 60)}s
                    </p>
                  </div>
                )}
              </div>
            )}
            {selectedActivity.body && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">
                  {selectedActivity.type === 'call' ? 'Notes' : 'Content'}
                </h3>
                <p className="text-sm text-foreground whitespace-pre-wrap">{selectedActivity.body}</p>
              </div>
            )}
            <div className="flex gap-2 pt-4 border-t">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => router.push(`/companies/${companyId}/activity`)}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View All Logs
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}


