"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { ActivityItem } from "@/lib/types/company";
import { ActivityFeed } from "@/components/company/activity-feed";
import { ActivityFilters } from "@/components/company/activity-filters";
import { Button } from "@/components/ui/button";
import { Plus, Mail, Phone, Calendar, FileText } from "lucide-react";


export default function CompanyActivityPage() {
  const params = useParams();
  const companyId = params.id as string;

  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    type: "all" as "all" | "email" | "meeting" | "call" | "note" | "task" | "upload",
    people: [] as string[],
    dateRange: "all" as "all" | "7d" | "30d" | "90d",
    sentiment: "all" as "all" | "positive" | "neutral" | "negative",
  });
  const [selectedActivity, setSelectedActivity] = useState<string | null>(null);

  const fetchActivities = useCallback(async () => {
    if (!companyId) return;

    try {
      setLoading(true);

      // Fetch email logs
      const { data: emailLogs } = await supabase
        .from("email_logs")
        .select("*")
        .eq("company_id", companyId)
        .order("sent_at", { ascending: false });

      // Fetch call logs
      const { data: callLogs } = await supabase
        .from("call_logs")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });

      // Fetch notes (from company_content)
      const { data: notes } = await supabase
        .from("company_content")
        .select("*")
        .eq("company_id", companyId)
        .eq("content_type", "note")
        .order("created_at", { ascending: false });

      // Combine and format activities
      const allActivities: ActivityItem[] = [
        ...(emailLogs?.map((log) => ({
          id: log.id,
          type: "email" as const,
          date: log.sent_at || log.received_at || log.created_at,
          summary: log.subject || "Email",
          body: log.body,
          company_id: log.company_id,
          created_at: log.created_at,
          sentiment: undefined,
        })) || []),
        ...(callLogs?.map((call) => ({
          id: call.id,
          type: "call" as const,
          date: call.created_at,
          summary: call.call_type === "voice_call" ? "Voice Call" : "Voicemail",
          body: call.transcription || call.notes,
          company_id: call.company_id,
          created_at: call.created_at,
          sentiment: undefined,
        })) || []),
        ...(notes?.map((note) => ({
          id: note.id,
          type: "note" as const,
          date: note.created_at,
          summary: "Note",
          body: note.content,
          company_id: note.company_id,
          created_at: note.created_at,
          sentiment: undefined,
        })) || []),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setActivities(allActivities);
    } catch (error) {
      console.error("Error fetching activities:", error);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  // Filter activities based on filters
  const filteredActivities = activities.filter((activity) => {
    if (filters.type !== "all" && activity.type !== filters.type) return false;
    if (filters.dateRange !== "all") {
      const days = filters.dateRange === "7d" ? 7 : filters.dateRange === "30d" ? 30 : 90;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      if (new Date(activity.date) < cutoff) return false;
    }
    if (filters.sentiment !== "all" && activity.sentiment !== filters.sentiment) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">Loading activities...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <div>
            <h2 className="text-2xl font-bold text-foreground tracking-tight">Activity</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {filteredActivities.length} activities
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Mail className="h-4 w-4 mr-2" />
              Email
            </Button>
            <Button variant="outline" size="sm">
              <Phone className="h-4 w-4 mr-2" />
              Log Call
            </Button>
            <Button variant="outline" size="sm">
              <Calendar className="h-4 w-4 mr-2" />
              Event
            </Button>
            <Button variant="outline" size="sm">
              <FileText className="h-4 w-4 mr-2" />
              Note
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-8">
          <ActivityFilters filters={filters} onFiltersChange={setFilters} />
        </div>

        {/* Activity Feed */}
        <div>
          <ActivityFeed
            activities={filteredActivities}
            companyId={companyId}
            selectedActivity={selectedActivity}
            onSelectActivity={setSelectedActivity}
          />
        </div>
      </div>
    </div>
  );
}


