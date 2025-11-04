"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/company/empty-state";
import { Calendar, Building2, User, Clock } from "lucide-react";
import type { Meeting } from "@/lib/types/company";

interface MeetingsTableProps {
  filters: {
    teamMember: string;
    cadence: string;
    channel: string;
    dateRange: string;
  };
}

export function MeetingsTable({ filters }: MeetingsTableProps) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"date" | "company" | "owner" | "stage">("date");

  useEffect(() => {
    fetchMeetings();
  }, [filters, sortBy]);

  const fetchMeetings = async () => {
    try {
      setLoading(true);
      // TODO: Replace with real query based on filters
      // For now, return mock data
      const mockMeetings: Meeting[] = [
        {
          id: "1",
          company_id: "1",
          scheduledAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
          type: "video",
          status: "scheduled",
          owner: "Current User",
        },
        {
          id: "2",
          company_id: "2",
          scheduledAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          type: "call",
          status: "scheduled",
          owner: "Current User",
        },
      ];

      setMeetings(mockMeetings);
    } catch (error) {
      console.error("Error fetching meetings:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "outline" | "destructive"> = {
      scheduled: "default",
      completed: "outline",
      cancelled: "outline",
      "no-show": "destructive",
    };
    return variants[status] || "outline";
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "video":
        return "📹";
      case "call":
        return "📞";
      case "in-person":
        return "🏢";
      default:
        return "📧";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-muted-foreground">Loading meetings...</div>
      </div>
    );
  }

  if (meetings.length === 0) {
    return (
      <EmptyState
        icon={Calendar}
        title="No pipeline activity yet"
        description="Add companies to pipeline, book your first meeting, or import call logs to get started."
        actionLabel="Book a Meeting"
        onAction={() => {
          // TODO: Open meeting booking modal
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Sort Controls */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Sort by:</span>
        {(["date", "company", "owner", "stage"] as const).map((option) => (
          <Button
            key={option}
            variant={sortBy === option ? "default" : "ghost"}
            size="sm"
            onClick={() => setSortBy(option)}
            className="text-xs h-7"
          >
            {option.charAt(0).toUpperCase() + option.slice(1)}
          </Button>
        ))}
      </div>

      {/* Table */}
      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-foreground">
                Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-foreground">
                Company
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-foreground">
                Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-foreground">
                Owner
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-foreground">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {meetings.map((meeting) => (
              <tr key={meeting.id} className="hover:bg-accent/50 transition-colors">
                <td className="px-4 py-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-foreground">
                      {new Date(meeting.scheduledAt).toLocaleDateString()}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-foreground">Company Name</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm">
                  <span className="text-foreground">{getTypeIcon(meeting.type)} {meeting.type}</span>
                </td>
                <td className="px-4 py-3 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-foreground">{meeting.owner || "Unassigned"}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm">
                  <Badge variant={getStatusBadge(meeting.status)}>
                    {meeting.status}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


