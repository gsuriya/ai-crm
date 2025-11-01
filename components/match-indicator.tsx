"use client";

import { FileText, Mail, Calendar, MessageSquare, File, FileIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const CONTENT_TYPE_ICONS: Record<string, any> = {
  meeting_log: Calendar,
  email: Mail,
  memo: FileText,
  note: MessageSquare,
  google_doc: FileIcon,
  document: File,
  pdf: File,
  call_transcript: MessageSquare,
  outreach_log: Mail,
  metadata: FileText,
  other: FileText,
};

const CONTENT_TYPE_COLORS: Record<string, string> = {
  meeting_log: "bg-primary/10 text-primary border-primary/20",
  email: "bg-primary/10 text-primary border-primary/20",
  memo: "bg-primary/10 text-primary border-primary/20",
  note: "bg-primary/10 text-primary border-primary/20",
  google_doc: "bg-primary/10 text-primary border-primary/20",
  document: "bg-primary/10 text-primary border-primary/20",
  pdf: "bg-primary/10 text-primary border-primary/20",
  call_transcript: "bg-primary/10 text-primary border-primary/20",
  outreach_log: "bg-primary/10 text-primary border-primary/20",
  metadata: "bg-primary/10 text-primary border-primary/20",
  other: "bg-primary/10 text-primary border-primary/20",
};

interface MatchIndicatorProps {
  contentType: string;
  source?: string;
  className?: string;
}

export function MatchIndicator({ contentType, source, className }: MatchIndicatorProps) {
  const Icon = CONTENT_TYPE_ICONS[contentType] || FileText;
  const colorClass = CONTENT_TYPE_COLORS[contentType] || CONTENT_TYPE_COLORS.other;
  
  const displayName = contentType
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  return (
    <div className={cn("inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-medium", colorClass, className)}>
      <Icon className="h-3 w-3" />
      <span>Found in {displayName}</span>
    </div>
  );
}

