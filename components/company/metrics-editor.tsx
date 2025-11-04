"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Edit, Save, X, Clock } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { EmptyState } from "./empty-state";
import { DollarSign } from "lucide-react";

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

interface MetricsEditorProps {
  financials: FinancialData[];
  companyId: string;
  onUpdate: () => void;
}

export function MetricsEditor({ financials, companyId, onUpdate }: MetricsEditorProps) {
  const [editingYear, setEditingYear] = useState<number | null>(null);
  const [formData, setFormData] = useState<Partial<FinancialData>>({});

  const handleEdit = (year: number) => {
    const financial = financials.find((f) => f.year === year);
    if (financial) {
      setFormData({
        year: financial.year,
        arr: financial.arr,
        gross_retention: financial.gross_retention,
        net_retention: financial.net_retention,
        gross_margin: financial.gross_margin,
        ebitda: financial.ebitda,
      });
      setEditingYear(year);
    }
  };

  const handleSave = async () => {
    if (!editingYear || !companyId) return;

    try {
      const data = {
        company_id: companyId,
        year: editingYear,
        arr: formData.arr || null,
        gross_retention: formData.gross_retention || null,
        net_retention: formData.net_retention || null,
        gross_margin: formData.gross_margin || null,
        ebitda: formData.ebitda || null,
      };

      const { error } = await supabase
        .from("company_financials")
        .upsert(data, { onConflict: "company_id,year" });

      if (error) throw error;

      setEditingYear(null);
      setFormData({});
      onUpdate();
    } catch (error: any) {
      console.error("Error saving metrics:", error);
      alert(`Error saving metrics: ${error.message}`);
    }
  };

  const handleCancel = () => {
    setEditingYear(null);
    setFormData({});
  };

  const formatCurrency = (value?: number) => {
    if (!value) return "";
    if (value >= 1000000) return `${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
    return `${value.toFixed(0)}`;
  };

  if (financials.length === 0) {
    return (
      <EmptyState
        icon={DollarSign}
        title="No metrics yet"
        description="Add operating metrics to track company performance."
        actionLabel="Add Metrics"
        onAction={() => {
          // TODO: Open add metrics modal
        }}
      />
    );
  }

  // Sort by year (newest first)
  const sortedFinancials = [...financials].sort((a, b) => b.year - a.year);

  return (
    <div className="space-y-4">
      {sortedFinancials.map((financial) => {
        const isEditing = editingYear === financial.year;

        return (
          <div
            key={financial.id}
            className="p-4 rounded-lg border border-border bg-background hover:bg-accent/50 transition-colors"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {financial.year}
                </Badge>
                {financial.updated_at && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>Updated {new Date(financial.updated_at).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
              {!isEditing && (
                <Button variant="ghost" size="sm" onClick={() => handleEdit(financial.year)}>
                  <Edit className="h-3 w-3" />
                </Button>
              )}
            </div>

            {isEditing ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-foreground mb-1 block">
                    ARR ($)
                  </label>
                  <Input
                    type="number"
                    value={formData.arr || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, arr: parseFloat(e.target.value) || undefined })
                    }
                    placeholder="e.g., 10000000"
                    className="text-xs"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium text-foreground mb-1 block">
                      Gross Retention (%)
                    </label>
                    <Input
                      type="number"
                      value={formData.gross_retention || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          gross_retention: parseFloat(e.target.value) || undefined,
                        })
                      }
                      placeholder="e.g., 95"
                      className="text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-foreground mb-1 block">
                      Net Retention (%)
                    </label>
                    <Input
                      type="number"
                      value={formData.net_retention || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          net_retention: parseFloat(e.target.value) || undefined,
                        })
                      }
                      placeholder="e.g., 120"
                      className="text-xs"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium text-foreground mb-1 block">
                      Gross Margin (%)
                    </label>
                    <Input
                      type="number"
                      value={formData.gross_margin || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          gross_margin: parseFloat(e.target.value) || undefined,
                        })
                      }
                      placeholder="e.g., 75"
                      className="text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-foreground mb-1 block">
                      EBITDA (%)
                    </label>
                    <Input
                      type="number"
                      value={formData.ebitda || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          ebitda: parseFloat(e.target.value) || undefined,
                        })
                      }
                      placeholder="e.g., 10"
                      className="text-xs"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <Button size="sm" onClick={handleSave} className="text-xs h-7 flex-1">
                    <Save className="h-3 w-3 mr-1" />
                    Save
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancel}
                    className="text-xs h-7 flex-1"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2 text-xs">
                {financial.arr && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">ARR</span>
                    <span className="font-semibold text-foreground">
                      ${formatCurrency(financial.arr)}
                    </span>
                  </div>
                )}
                {financial.gross_retention && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Gross Retention</span>
                    <span className="font-semibold text-foreground">
                      {financial.gross_retention}%
                    </span>
                  </div>
                )}
                {financial.net_retention && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Net Retention</span>
                    <span className="font-semibold text-foreground">
                      {financial.net_retention}%
                    </span>
                  </div>
                )}
                {financial.gross_margin && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Gross Margin</span>
                    <span className="font-semibold text-foreground">
                      {financial.gross_margin}%
                    </span>
                  </div>
                )}
                {financial.ebitda && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">EBITDA</span>
                    <span className="font-semibold text-foreground">{financial.ebitda}%</span>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}


