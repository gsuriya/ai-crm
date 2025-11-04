"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Mail, Phone, Calendar, FileText, CheckSquare, Upload } from "lucide-react";

interface ActivityFiltersProps {
  filters: {
    type: "all" | "email" | "meeting" | "call" | "note" | "task" | "upload";
    people: string[];
    dateRange: "all" | "7d" | "30d" | "90d";
    sentiment: "all" | "positive" | "neutral" | "negative";
  };
  onFiltersChange: (filters: ActivityFiltersProps["filters"]) => void;
}

export function ActivityFilters({ filters, onFiltersChange }: ActivityFiltersProps) {
  const updateFilter = (key: keyof typeof filters, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onFiltersChange({
      type: "all",
      people: [],
      dateRange: "all",
      sentiment: "all",
    });
  };

  const hasActiveFilters =
    filters.type !== "all" ||
    filters.people.length > 0 ||
    filters.dateRange !== "all" ||
    filters.sentiment !== "all";

  const getTypeIcon = (type: string) => {
    const icons: Record<string, any> = {
      email: Mail,
      meeting: Calendar,
      call: Phone,
      note: FileText,
      task: CheckSquare,
      upload: Upload,
    };
    return icons[type] || FileText;
  };

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span className="text-sm font-medium text-foreground">Filters:</span>

      {/* Type Filter */}
      <Select value={filters.type} onValueChange={(value) => updateFilter("type", value)}>
        <SelectTrigger className="w-[150px] h-9">
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Types</SelectItem>
          <SelectItem value="email">Email</SelectItem>
          <SelectItem value="meeting">Meeting</SelectItem>
          <SelectItem value="call">Call</SelectItem>
          <SelectItem value="note">Note</SelectItem>
          <SelectItem value="task">Task</SelectItem>
          <SelectItem value="upload">Upload</SelectItem>
        </SelectContent>
      </Select>

      {/* People Filter */}
      <Select
        value={filters.people.length > 0 ? filters.people[0] : "all"}
        onValueChange={(value) =>
          updateFilter("people", value === "all" ? [] : [value])
        }
      >
        <SelectTrigger className="w-[150px] h-9">
          <SelectValue placeholder="People" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All People</SelectItem>
          <SelectItem value="person1">Person 1</SelectItem>
          <SelectItem value="person2">Person 2</SelectItem>
        </SelectContent>
      </Select>

      {/* Date Range Filter */}
      <Select
        value={filters.dateRange}
        onValueChange={(value) => updateFilter("dateRange", value)}
      >
        <SelectTrigger className="w-[150px] h-9">
          <SelectValue placeholder="Date" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Time</SelectItem>
          <SelectItem value="7d">Last 7 days</SelectItem>
          <SelectItem value="30d">Last 30 days</SelectItem>
          <SelectItem value="90d">Last 90 days</SelectItem>
        </SelectContent>
      </Select>

      {/* Sentiment Filter */}
      <Select
        value={filters.sentiment}
        onValueChange={(value) => updateFilter("sentiment", value)}
      >
        <SelectTrigger className="w-[150px] h-9">
          <SelectValue placeholder="Sentiment" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Sentiment</SelectItem>
          <SelectItem value="positive">Positive</SelectItem>
          <SelectItem value="neutral">Neutral</SelectItem>
          <SelectItem value="negative">Negative</SelectItem>
        </SelectContent>
      </Select>

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs h-9">
          <X className="h-3 w-3 mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
}


