"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { CardSection } from "@/components/company/card-section";
import { Button } from "@/components/ui/button";
import { Plus, Workflow } from "lucide-react";
import { EmptyState } from "@/components/company/empty-state";

export default function CompanyCadencesPage() {
  const params = useParams();
  const companyId = params.id as string;

  const [cadences, setCadences] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCadences = useCallback(async () => {
    if (!companyId) return;

    try {
      setLoading(true);

      // Fetch cadences for this company
      const { data, error } = await supabase
        .from("cadences")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCadences(data || []);
    } catch (error) {
      console.error("Error fetching cadences:", error);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchCadences();
  }, [fetchCadences]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">Loading cadences...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-foreground tracking-tight">Cadences</h2>
            <p className="text-sm text-muted-foreground mt-2">
              Manage outreach cadences and sequences for this company
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" className="transition-all duration-200">
              <Plus className="h-4 w-4 mr-2" />
              New Cadence
            </Button>
          </div>
        </div>

        {cadences.length === 0 ? (
          <CardSection title="Cadences">
            <EmptyState
              icon={Workflow}
              title="No cadences yet"
              description="Create a cadence to start automated outreach sequences for this company."
              actionLabel="Create Cadence"
              onAction={() => {
                // TODO: Implement cadence creation
                console.log("Create cadence");
              }}
            />
          </CardSection>
        ) : (
          <div className="space-y-4">
            {cadences.map((cadence) => (
              <CardSection
                key={cadence.id}
                title={cadence.name || "Untitled Cadence"}
                action={
                  <Button variant="ghost" size="sm" className="transition-all duration-200">
                    View
                  </Button>
                }
              >
                <p className="text-sm text-muted-foreground">
                  {cadence.description || "No description"}
                </p>
              </CardSection>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

