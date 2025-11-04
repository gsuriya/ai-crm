"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, Reply, ReplyAll, Forward, Paperclip, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface EmailThreadProps {
  activityId: string;
  companyId: string;
}

interface EmailMessage {
  id: string;
  subject: string;
  body: string;
  from_email: string;
  to_email: string;
  sent_at: string;
  direction: "sent" | "received";
  attachments?: Array<{ name: string; url: string; size: number }>;
}

export function EmailThread({ activityId, companyId }: EmailThreadProps) {
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAIActions, setShowAIActions] = useState(false);

  useEffect(() => {
    fetchEmailThread();
  }, [activityId, companyId]);

  const fetchEmailThread = async () => {
    try {
      setLoading(true);
      // Fetch email thread from email_logs
      const { data, error } = await supabase
        .from("email_logs")
        .select("*")
        .eq("id", activityId)
        .single();

      if (error) throw error;

      // For now, just show the single email
      // TODO: Fetch entire thread by thread_id
      setMessages([
        {
          id: data.id,
          subject: data.subject || "No subject",
          body: data.body || "",
          from_email: data.from_email,
          to_email: data.to_email,
          sent_at: data.sent_at || data.received_at || data.created_at,
          direction: data.direction,
          attachments: data.metadata?.attachments || [],
        },
      ]);
    } catch (error) {
      console.error("Error fetching email thread:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        Loading email thread...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {messages.map((message) => (
        <div key={message.id} className="border border-border rounded-lg p-4 bg-background">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <Badge variant={message.direction === "sent" ? "default" : "outline"}>
                  {message.direction === "sent" ? "Sent" : "Received"}
                </Badge>
                <span className="text-sm font-semibold text-foreground">
                  {message.subject}
                </span>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <div>
                  <span className="font-medium">From:</span> {message.from_email}
                </div>
                <div>
                  <span className="font-medium">To:</span> {message.to_email}
                </div>
                <div>
                  <span className="font-medium">Date:</span>{" "}
                  {new Date(message.sent_at).toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="mb-3 p-2 rounded-lg bg-muted/50 border border-border">
              <div className="flex items-center gap-2 mb-2">
                <Paperclip className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs font-medium text-foreground">
                  Attachments ({message.attachments.length})
                </span>
              </div>
              <div className="space-y-1">
                {message.attachments.map((attachment, idx) => (
                  <a
                    key={idx}
                    href={attachment.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline block"
                  >
                    {attachment.name} ({(attachment.size / 1024).toFixed(1)} KB)
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Email Body */}
          <div className="prose prose-sm max-w-none mb-4">
            <div
              className="text-sm text-foreground whitespace-pre-wrap"
              dangerouslySetInnerHTML={{ __html: message.body }}
            />
          </div>

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
                    Summarize
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs h-7">
                    Extract Action Items
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs h-7">
                    Sentiment Analysis
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-3 border-t border-border">
            <Button variant="outline" size="sm" className="h-7 text-xs">
              <Reply className="h-3 w-3 mr-1" />
              Reply
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs">
              <ReplyAll className="h-3 w-3 mr-1" />
              Reply All
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs">
              <Forward className="h-3 w-3 mr-1" />
              Forward
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}


