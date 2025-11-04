"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Users, Clock, Sparkles, FileText, CheckCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface MeetingCardProps {
  activityId: string;
  companyId: string;
}

interface Meeting {
  id: string;
  title: string;
  description?: string;
  scheduledAt: string;
  attendedAt?: string;
  attendees: Array<{ name: string; email: string; role: string }>;
  transcript?: string;
  summary?: string;
  followUpBullets?: string[];
}

export function MeetingCard({ activityId, companyId }: MeetingCardProps) {
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAIActions, setShowAIActions] = useState(false);

  useEffect(() => {
    fetchMeeting();
  }, [activityId, companyId]);

  const fetchMeeting = async () => {
    try {
      setLoading(true);
      // TODO: Fetch meeting from meetings table or company_content
      // For now, use mock data
      setMeeting({
        id: activityId,
        title: "Product Demo Call",
        description: "Discussing product features and pricing",
        scheduledAt: new Date().toISOString(),
        attendees: [
          { name: "John Doe", email: "john@company.com", role: "CEO" },
          { name: "Jane Smith", email: "jane@company.com", role: "CTO" },
        ],
        transcript: "Meeting transcript would go here...",
        summary: "Discussed product roadmap and pricing options. Next steps: Send pricing proposal.",
        followUpBullets: [
          "Send pricing proposal by end of week",
          "Schedule follow-up call for next week",
          "Share product demo video",
        ],
      });
    } catch (error) {
      console.error("Error fetching meeting:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        Loading meeting details...
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        Meeting not found
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="border border-border rounded-lg p-4 bg-background">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">
                {meeting.title}
              </span>
            </div>
            {meeting.description && (
              <p className="text-sm text-muted-foreground mb-2">
                {meeting.description}
              </p>
            )}
            <div className="text-xs text-muted-foreground space-y-1">
              <div className="flex items-center gap-2">
                <Clock className="h-3 w-3" />
                <span>
                  Scheduled: {new Date(meeting.scheduledAt).toLocaleString()}
                </span>
              </div>
              {meeting.attendedAt && (
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3" />
                  <span>
                    Attended: {new Date(meeting.attendedAt).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Attendees */}
        {meeting.attendees && meeting.attendees.length > 0 && (
          <div className="mb-3 p-2 rounded-lg bg-muted/50 border border-border">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs font-medium text-foreground">
                Attendees ({meeting.attendees.length})
              </span>
            </div>
            <div className="space-y-1">
              {meeting.attendees.map((attendee, idx) => (
                <div key={idx} className="text-xs text-muted-foreground">
                  {attendee.name} ({attendee.role}) - {attendee.email}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Summary */}
        {meeting.summary && (
          <div className="mb-3 p-3 rounded-lg bg-accent/50 border border-border">
            <div className="text-xs font-medium text-foreground mb-1">Summary</div>
            <p className="text-sm text-muted-foreground">{meeting.summary}</p>
          </div>
        )}

        {/* Follow-up Bullets */}
        {meeting.followUpBullets && meeting.followUpBullets.length > 0 && (
          <div className="mb-3 p-3 rounded-lg bg-blue-50 border border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-3 w-3 text-blue-600" />
              <span className="text-xs font-medium text-foreground">
                AI Follow-up Bullets
              </span>
            </div>
            <ul className="space-y-1">
              {meeting.followUpBullets.map((bullet, idx) => (
                <li key={idx} className="text-xs text-muted-foreground flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">•</span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Transcript */}
        {meeting.transcript && (
          <div className="mb-3 p-3 rounded-lg bg-muted/50 border border-border">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <FileText className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs font-medium text-foreground">Transcript</span>
              </div>
              <Button variant="ghost" size="sm" className="h-6 text-xs">
                Expand
              </Button>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-3">
              {meeting.transcript}
            </p>
          </div>
        )}

        {/* AI Actions */}
        <div className="pt-3 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAIActions(!showAIActions)}
            className="text-xs h-7"
          >
            <Sparkles className="h-3 w-3 mr-1" />
            AI Actions
          </Button>
          {showAIActions && (
            <div className="mt-2 p-3 rounded-lg bg-accent/50 border border-border">
              <div className="flex items-center gap-2 mb-2">
                <Button variant="outline" size="sm" className="text-xs h-7">
                  Generate Follow-up
                </Button>
                <Button variant="outline" size="sm" className="text-xs h-7">
                  Extract Action Items
                </Button>
                <Button variant="outline" size="sm" className="text-xs h-7">
                  Create Task
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

