"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ZoomIn, ZoomOut, User } from "lucide-react";
import type { Person } from "@/lib/types/company";
import { EmptyState } from "./empty-state";
import { motion } from "framer-motion";

interface OrgGraphProps {
  people: Person[];
  companyId: string;
}

export function OrgGraph({ people, companyId }: OrgGraphProps) {
  const [zoom, setZoom] = useState(1);

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.2, 2));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.2, 0.5));
  };

  if (people.length === 0) {
    return (
      <EmptyState
        icon={User}
        title="No org chart data"
        description="Add contacts to build the organization chart."
        actionLabel="Add Contact"
        onAction={() => {
          // TODO: Open add contact modal
        }}
      />
    );
  }

  // Group by title/function to create org structure
  const groupedByTitle = people.reduce((acc, person) => {
    const title = person.title || "Other";
    const department = title.split(" ")[0] || "Other";
    if (!acc[department]) acc[department] = [];
    acc[department].push(person);
    return acc;
  }, {} as Record<string, Person[]>);

  return (
    <div className="space-y-4">
      {/* Zoom Controls */}
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={handleZoomOut}>
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="text-xs text-muted-foreground">
          {Math.round(zoom * 100)}%
        </span>
        <Button variant="outline" size="sm" onClick={handleZoomIn}>
          <ZoomIn className="h-4 w-4" />
        </Button>
      </div>

      {/* Org Chart */}
      <div
        className="overflow-auto border border-border rounded-lg p-4 bg-muted/20"
        style={{ maxHeight: "400px" }}
      >
        <div
          style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }}
          className="min-w-full"
        >
          {Object.entries(groupedByTitle).map(([department, deptPeople], index) => (
            <motion.div
              key={department}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="mb-4"
            >
              <div className="text-xs font-semibold text-foreground mb-2 uppercase tracking-wide">
                {department}
              </div>
              <div className="flex flex-wrap gap-2">
                {deptPeople.map((person) => (
                  <div
                    key={person.id}
                    className="p-2 rounded-lg border border-border bg-background hover:bg-accent/50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-3 w-3 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-foreground truncate">
                          {person.first_name} {person.last_name}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {person.title || "—"}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}


