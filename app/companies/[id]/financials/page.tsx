"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { RoundsTimeline } from "@/components/company/rounds-timeline";
import { MetricsEditor } from "@/components/company/metrics-editor";
import { FinancialCharts } from "@/components/company/financial-charts";
import { AnomalyChecks } from "@/components/company/anomaly-checks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, DollarSign, TrendingUp, Download } from "lucide-react";

export const dynamic = 'force-dynamic';

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
      <div className="max-w-7xl mx-auto px-6 py-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Financials</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Funding & performance metrics with charts and benchmarks
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleCopyToClipboard}>
              Copy
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
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

        <div className="grid grid-cols-12 gap-6">
          {/* Left Column */}
          <div className="col-span-12 lg:col-span-8 space-y-6">
            {/* Rounds Timeline */}
            <Card className="rounded-2xl shadow-sm border border-border p-5">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold text-foreground">
                  Funding Rounds
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Timeline of funding rounds with lead investors and participants
                </p>
              </CardHeader>
              <CardContent>
                <RoundsTimeline rounds={rounds} companyId={companyId} />
              </CardContent>
            </Card>

            {/* Financial Charts */}
            <Card className="rounded-2xl shadow-sm border border-border p-5">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold text-foreground">
                  Financial Charts
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  ARR growth, Burn vs Runway, NRR trends
                </p>
              </CardHeader>
              <CardContent>
                <FinancialCharts financials={financials} companyId={companyId} />
              </CardContent>
            </Card>
          </div>

          {/* Right Column */}
          <div className="col-span-12 lg:col-span-4 space-y-6">
            {/* Metrics Editor */}
            <Card className="rounded-2xl shadow-sm border border-border p-5">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold text-foreground">
                  Operating Metrics
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Editable with provenance tracking
                </p>
              </CardHeader>
              <CardContent>
                <MetricsEditor
                  financials={financials}
                  companyId={companyId}
                  onUpdate={fetchFinancials}
                />
              </CardContent>
            </Card>

            {/* Anomaly Checks */}
            <Card className="rounded-2xl shadow-sm border border-border p-5">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold text-foreground">
                  Anomaly Checks
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  AI-powered anomaly detection
                </p>
              </CardHeader>
              <CardContent>
                <AnomalyChecks financials={financials} companyId={companyId} />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}


