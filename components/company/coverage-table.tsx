"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Mail, Phone, User, MoreVertical, Tag } from "lucide-react";
import type { Person } from "@/lib/types/company";
import { motion } from "framer-motion";
import { EmptyState } from "./empty-state";

interface CoverageTableProps {
  people: Person[];
  companyId: string;
}

export function CoverageTable({ people, companyId }: CoverageTableProps) {
  const [selectedPeople, setSelectedPeople] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedPeople(new Set(people.map((p) => p.id)));
      setShowBulkActions(true);
    } else {
      setSelectedPeople(new Set());
      setShowBulkActions(false);
    }
  };

  const handleSelectPerson = (personId: string, checked: boolean) => {
    const newSelected = new Set(selectedPeople);
    if (checked) {
      newSelected.add(personId);
    } else {
      newSelected.delete(personId);
    }
    setSelectedPeople(newSelected);
    setShowBulkActions(newSelected.size > 0);
  };

  const getRelationshipHeat = (person: Person) => {
    // Calculate heat based on threads, strength, and last touch
    const threads = person.threads || 0;
    const strength = person.strength || 0;
    const daysSinceTouch = person.lastTouchAt
      ? Math.floor((Date.now() - new Date(person.lastTouchAt).getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    if (threads > 5 && strength > 50 && daysSinceTouch < 30) return "high";
    if (threads > 2 && strength > 25 && daysSinceTouch < 60) return "medium";
    return "low";
  };

  const getHeatColor = (heat: string) => {
    const colors: Record<string, string> = {
      high: "bg-green-500",
      medium: "bg-yellow-500",
      low: "bg-gray-300",
    };
    return colors[heat] || colors.low;
  };

  if (people.length === 0) {
    return (
      <EmptyState
        icon={User}
        title="No contacts yet"
        description="Add contacts to see coverage and relationship heat."
        actionLabel="Add Contact"
        onAction={() => {
          // TODO: Open add contact modal
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Bulk Actions Bar */}
      {showBulkActions && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 p-3 bg-accent rounded-lg border border-border"
        >
          <span className="text-sm font-medium text-foreground">
            {selectedPeople.size} selected
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <Select>
              <SelectTrigger className="w-[150px] h-8">
                <SelectValue placeholder="Assign Owner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user1">Current User</SelectItem>
                <SelectItem value="user2">Team Member 2</SelectItem>
              </SelectContent>
            </Select>
            <Select>
              <SelectTrigger className="w-[150px] h-8">
                <SelectValue placeholder="Add Tags" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="decision-maker">Decision Maker</SelectItem>
                <SelectItem value="champion">Champion</SelectItem>
                <SelectItem value="influencer">Influencer</SelectItem>
              </SelectContent>
            </Select>
            <Select>
              <SelectTrigger className="w-[150px] h-8">
                <SelectValue placeholder="Move to Cadence" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cadence1">Warm Outreach</SelectItem>
                <SelectItem value="cadence2">Cold Outreach</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" onClick={() => setSelectedPeople(new Set())}>
              Clear
            </Button>
          </div>
        </motion.div>
      )}

      {/* Table */}
      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-foreground w-12">
                <Checkbox
                  checked={selectedPeople.size === people.length && people.length > 0}
                  onCheckedChange={handleSelectAll}
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-foreground">
                Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-foreground">
                Title
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-foreground">
                Contact
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-foreground">
                Owner
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-foreground">
                Heat
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-foreground">
                Last Touch
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-foreground w-12">
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {people.map((person) => {
              const heat = getRelationshipHeat(person);
              const daysSinceTouch = person.lastTouchAt
                ? Math.floor((Date.now() - new Date(person.lastTouchAt).getTime()) / (1000 * 60 * 60 * 24))
                : null;

              return (
                <tr
                  key={person.id}
                  className="hover:bg-accent/50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <Checkbox
                      checked={selectedPeople.has(person.id)}
                      onCheckedChange={(checked) =>
                        handleSelectPerson(person.id, checked as boolean)
                      }
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <span className="text-sm font-medium text-foreground">
                        {person.first_name} {person.last_name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-muted-foreground">
                      {person.title || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {person.email && (
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                          <Mail className="h-3 w-3" />
                        </Button>
                      )}
                      {person.phone && (
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                          <Phone className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-muted-foreground">
                      {person.owner || "Unassigned"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div
                        className={`h-3 w-3 rounded-full ${getHeatColor(heat)}`}
                        title={heat}
                      />
                      <Badge variant="outline" className="text-xs">
                        {heat}
                      </Badge>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-muted-foreground">
                      {daysSinceTouch !== null
                        ? `${daysSinceTouch}d ago`
                        : "Never"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}


