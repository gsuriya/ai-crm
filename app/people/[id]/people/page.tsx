"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Person } from "@/lib/types/company";
import { CoverageTable } from "@/components/company/coverage-table";
import { OrgGraph } from "@/components/company/org-graph";
import { CardSection } from "@/components/company/card-section";
import { Button } from "@/components/ui/button";
import { Plus, Upload } from "lucide-react";


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
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <div>
            <h2 className="text-2xl font-bold text-foreground tracking-tight">People</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {people.length} contacts
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

        <div className="grid grid-cols-12 gap-12">
          {/* Coverage Map */}
          <div className="col-span-12 lg:col-span-8">
            <CardSection title="Coverage Map">
              <CoverageTable people={people} companyId={companyId} />
            </CardSection>
          </div>

          {/* Org Graph */}
          <div className="col-span-12 lg:col-span-4">
            <CardSection title="Org Graph">
              <OrgGraph people={people} companyId={companyId} />
            </CardSection>
          </div>
        </div>
      </div>
    </div>
  );
}


