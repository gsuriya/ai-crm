"use client";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";

interface PipelineFiltersProps {
  filters: {
    teamMember: string;
    cadence: string;
    channel: string;
    dateRange: string;
  };
  onFiltersChange: (filters: PipelineFiltersProps["filters"]) => void;
}

export function PipelineFilters({ filters, onFiltersChange }: PipelineFiltersProps) {
  const updateFilter = (key: keyof typeof filters, value: string) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onFiltersChange({
      teamMember: "",
      cadence: "",
      channel: "",
      dateRange: "90d",
    });
  };

  const hasActiveFilters = filters.teamMember || filters.cadence || filters.channel || filters.dateRange !== "90d";

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span className="text-sm font-medium text-foreground">Filters:</span>
      
      <Select value={filters.teamMember || "all"} onValueChange={(value) => updateFilter("teamMember", value === "all" ? "" : value)}>
        <SelectTrigger className="w-[150px] h-9">
          <SelectValue placeholder="Team Member" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Members</SelectItem>
          <SelectItem value="user1">Current User</SelectItem>
          <SelectItem value="user2">Team Member 2</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filters.cadence || "all"} onValueChange={(value) => updateFilter("cadence", value === "all" ? "" : value)}>
        <SelectTrigger className="w-[150px] h-9">
          <SelectValue placeholder="Cadence" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Cadences</SelectItem>
          <SelectItem value="cadence1">Warm Outreach</SelectItem>
          <SelectItem value="cadence2">Cold Outreach</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filters.channel || "all"} onValueChange={(value) => updateFilter("channel", value === "all" ? "" : value)}>
        <SelectTrigger className="w-[150px] h-9">
          <SelectValue placeholder="Channel" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Channels</SelectItem>
          <SelectItem value="email">Email</SelectItem>
          <SelectItem value="voice">Voice</SelectItem>
          <SelectItem value="linkedin">LinkedIn</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filters.dateRange} onValueChange={(value) => updateFilter("dateRange", value)}>
        <SelectTrigger className="w-[150px] h-9">
          <SelectValue placeholder="Date Range" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="7d">Last 7 days</SelectItem>
          <SelectItem value="30d">Last 30 days</SelectItem>
          <SelectItem value="90d">Last 90 days</SelectItem>
          <SelectItem value="all">All time</SelectItem>
        </SelectContent>
      </Select>

      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          className="text-xs h-9"
        >
          <X className="h-3 w-3 mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
}

