"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { MatchIndicator } from "./match-indicator";
import { cn } from "@/lib/utils";

export interface MatchSnippetProps {
  contentSnippet: string;
  contentType: string;
  source?: string;
  metadata?: Record<string, any>;
  matchScore: number;
  contentDate: string;
  className?: string;
  searchQuery?: string; // Add search query for highlighting
}

export function MatchSnippet({
  contentSnippet,
  contentType,
  source,
  metadata,
  matchScore,
  contentDate,
  className,
  searchQuery,
}: MatchSnippetProps) {
  const [expanded, setExpanded] = useState(false);

  const scorePercentage = Math.round(matchScore * 100);

  // Highlight matching terms in the snippet
  const highlightText = (text: string, query?: string) => {
    if (!query || query.length < 2) {
      return text;
    }

    // Extract key terms from query (simple word extraction)
    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    
    if (queryWords.length === 0) {
      return text;
    }

    // Create a regex pattern to match any of the query words
    const pattern = new RegExp(`(${queryWords.join('|')})`, 'gi');
    
    return text.split(pattern).map((part, i) => {
      if (queryWords.some(word => part.toLowerCase() === word.toLowerCase())) {
        return <strong key={i} className="font-semibold text-foreground bg-accent/50 px-0.5 rounded">{part}</strong>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  const displayText = expanded ? contentSnippet : `${contentSnippet.slice(0, 150)}${contentSnippet.length > 150 ? '...' : ''}`;

  return (
    <div className={cn("rounded-lg border border-border bg-background p-3", className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <MatchIndicator contentType={contentType} source={source} />
            <span className="text-xs text-muted-foreground">
              {scorePercentage}% match
            </span>
          </div>
          <p className="text-sm text-foreground">
            {highlightText(displayText, searchQuery)}
          </p>
          {source && (
            <p className="text-xs text-muted-foreground mt-1">
              Source: {source}
            </p>
          )}
          {metadata?.title && (
            <p className="text-xs text-muted-foreground mt-1">
              {metadata.title}
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            {new Date(contentDate).toLocaleDateString()}
          </p>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          {expanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}

