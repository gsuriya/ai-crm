"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { RoundsTimeline } from "@/components/company/rounds-timeline";
import { MetricsEditor } from "@/components/company/metrics-editor";
import { FinancialCharts } from "@/components/company/financial-charts";
import { CardSection } from "@/components/company/card-section";
import { Button } from "@/components/ui/button";
import { Plus, Download } from "lucide-react";


interface FinancialData {
  id: string;
  company_id: string;
  year: number;
  arr?: number;
  gross_retention?: number;
  net_retention?: number;
  gross_margin?: number;
  ebitda?: number;
  created_at: string;
  updated_at: string;
}

export default function CompanyFinancialsPage() {
  const params = useParams();
  const companyId = params.id as string;

  const [financials, setFinancials] = useState<FinancialData[]>([]);
  const [rounds, setRounds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMetricsModal, setShowMetricsModal] = useState(false);
  const [editingYear, setEditingYear] = useState<number | null>(null);

  const fetchFinancials = useCallback(async () => {
    if (!companyId) return;

    try {
      setLoading(true);

      // Fetch financials
      const { data: financialsData, error: financialsError } = await supabase
        .from("company_financials")
        .select("*")
        .eq("company_id", companyId)
        .order("year", { ascending: false });

      if (financialsError) throw financialsError;
      setFinancials(financialsData || []);

      // Fetch rounds (from company_content or metadata)
      // TODO: Create rounds table if it doesn't exist
      // For now, use mock data
      setRounds([
        {
          id: "1",
          round_type: "Series A",
          size: 10000000,
          date: "2024-01-15",
          lead: "VC Firm A",
          participants: ["VC Firm A", "VC Firm B"],
        },
        {
          id: "2",
          round_type: "Seed",
          size: 2000000,
          date: "2023-06-01",
          lead: "Angel Investor",
          participants: ["Angel Investor", "VC Firm C"],
        },
      ]);
    } catch (error) {
      console.error("Error fetching financials:", error);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchFinancials();
  }, [fetchFinancials]);

  const handleExportCSV = () => {
    // TODO: Export financials to CSV
    console.log("Export to CSV");
  };

  const handleCopyToClipboard = () => {
    // TODO: Copy financials to clipboard
    console.log("Copy to clipboard");
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">Loading financials...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <div>
            <h2 className="text-2xl font-bold text-foreground tracking-tight">Financials</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleCopyToClipboard}>
              Copy
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setEditingYear(null);
                setShowMetricsModal(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Financials
            </Button>
          </div>
        </div>

        <div className="space-y-12">
          {/* Funding Rounds */}
          <CardSection title="Funding Rounds">
            <RoundsTimeline rounds={rounds} companyId={companyId} />
          </CardSection>

          {/* Charts */}
          <CardSection title="Charts">
            <FinancialCharts financials={financials} companyId={companyId} />
          </CardSection>

          {/* Metrics */}
          <CardSection title="Metrics">
            <MetricsEditor
              financials={financials}
              companyId={companyId}
              onUpdate={fetchFinancials}
            />
          </CardSection>
        </div>
      </div>
    </div>
  );
}


