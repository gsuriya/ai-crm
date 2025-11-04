"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Person } from "@/lib/types/company";
import { CoverageTable } from "@/components/company/coverage-table";
import { OrgGraph } from "@/components/company/org-graph";
import { Gaps } from "@/components/company/gaps";
import { Button } from "@/components/ui/button";
import { Plus, Upload, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = 'force-dynamic';

export default function CompanyPeoplePage() {
  const params = useParams();
  const companyId = params.id as string;

  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddContactModal, setShowAddContactModal] = useState(false);

  const fetchPeople = useCallback(async () => {
    if (!companyId) return;

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Map contacts to Person type
      const mappedPeople: Person[] = (data || []).map((contact) => ({
        id: contact.id,
        company_id: contact.company_id,
        first_name: contact.first_name,
        last_name: contact.last_name,
        title: contact.title || "",
        function: contact.title?.split(" ")[0] || "",
        seniority: "",
        owner: "",
        lastTouchAt: contact.updated_at,
        threads: 0,
        strength: 0,
        tags: [],
        cadenceId: "",
        email: contact.email || "",
        phone: contact.phone || "",
        created_at: contact.created_at,
        updated_at: contact.updated_at,
      }));

      setPeople(mappedPeople);
    } catch (error) {
      console.error("Error fetching people:", error);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchPeople();
  }, [fetchPeople]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">Loading people...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="max-w-7xl mx-auto px-6 py-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-foreground">People</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {people.length} contacts • Show coverage, relationship heat, and gaps
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Upload className="h-4 w-4 mr-2" />
              Bulk Import
            </Button>
            <Button size="sm" onClick={() => setShowAddContactModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Contact
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Coverage Map */}
          <div className="col-span-12 lg:col-span-8">
            <Card className="rounded-2xl shadow-sm border border-border p-5">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold text-foreground">
                  Coverage Map
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Table + mini heatmap showing relationship strength
                </p>
              </CardHeader>
              <CardContent>
                <CoverageTable people={people} companyId={companyId} />
              </CardContent>
            </Card>
          </div>

          {/* Org Graph */}
          <div className="col-span-12 lg:col-span-4">
            <Card className="rounded-2xl shadow-sm border border-border p-5">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold text-foreground">
                  Org Graph
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Compact, zoomable organization chart
                </p>
              </CardHeader>
              <CardContent>
                <OrgGraph people={people} companyId={companyId} />
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Gaps */}
        <div className="mt-6">
          <Card className="rounded-2xl shadow-sm border border-border p-5">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <CardTitle className="text-lg font-semibold text-foreground">
                    Coverage Gaps
                  </CardTitle>
                </div>
                <Button variant="ghost" size="sm" className="text-xs">
                  Auto-capture
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                AI-suggested contacts from email/calendar; de-dupe; map domains/aliases
              </p>
            </CardHeader>
            <CardContent>
              <Gaps companyId={companyId} people={people} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}


