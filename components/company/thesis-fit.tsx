"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit, X, Plus, Sparkles } from "lucide-react";
import type { Company } from "@/lib/types/company";
import { motion } from "framer-motion";

interface ThesisFitProps {
  companyId: string;
  company: Company;
}

interface ThesisCriteria {
  icp?: string;
  geo?: string;
  checkSize?: string;
  model?: string;
}

export function ThesisFit({ companyId, company }: ThesisFitProps) {
  const [criteria, setCriteria] = useState<ThesisCriteria>({
    icp: company.industry || "",
    geo: company.location || "",
    checkSize: "",
    model: "",
  });
  const [editingChip, setEditingChip] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchThesisFit();
  }, [companyId, criteria]);

  const fetchThesisFit = async () => {
    try {
      setLoading(true);
      // Call AI endpoint for thesis fit explanation
      const response = await fetch(`/api/ai/thesis-fit?companyId=${companyId}`);
      if (response.ok) {
        const data = await response.json();
        setAiExplanation(data.explanation || null);
      }
    } catch (error) {
      console.error("Error fetching thesis fit:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleChipSave = (key: keyof ThesisCriteria) => {
    setCriteria({ ...criteria, [key]: editingValue });
    setEditingChip(null);
    setEditingValue("");
  };

  const handleChipDelete = (key: keyof ThesisCriteria) => {
    setCriteria({ ...criteria, [key]: "" });
  };

  const chips = [
    { key: "icp" as const, label: "ICP", value: criteria.icp },
    { key: "geo" as const, label: "Geo", value: criteria.geo },
    { key: "checkSize" as const, label: "Check Size", value: criteria.checkSize },
    { key: "model" as const, label: "Model", value: criteria.model },
  ].filter((chip) => chip.value);

  return (
    <Card className="rounded-2xl shadow-sm border border-border p-5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <CardTitle className="text-lg font-semibold text-foreground">
              Thesis Fit
            </CardTitle>
          </div>
          <Button variant="ghost" size="sm">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Editable Chips */}
        <div className="flex flex-wrap gap-2">
          {chips.map((chip) => (
            <Badge
              key={chip.key}
              variant="outline"
              className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-accent"
            >
              <span className="text-xs font-medium">{chip.label}:</span>
              {editingChip === chip.key ? (
                <input
                  type="text"
                  value={editingValue}
                  onChange={(e) => setEditingValue(e.target.value)}
                  onBlur={() => handleChipSave(chip.key)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleChipSave(chip.key);
                    if (e.key === "Escape") setEditingChip(null);
                  }}
                  autoFocus
                  className="w-20 text-xs bg-transparent border-none outline-none"
                />
              ) : (
                <span className="text-xs">{chip.value}</span>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={() => {
                  setEditingChip(chip.key);
                  setEditingValue(chip.value || "");
                }}
              >
                <Edit className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={() => handleChipDelete(chip.key)}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))}
          {chips.length < 4 && (
            <Badge
              variant="outline"
              className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-accent border-dashed"
              onClick={() => {
                // TODO: Show add chip modal
                console.log("Add chip");
              }}
            >
              <Plus className="h-3 w-3" />
              <span className="text-xs">Add</span>
            </Badge>
          )}
        </div>

        {/* AI Explanation */}
        {loading ? (
          <div className="text-sm text-muted-foreground animate-pulse">
            Generating thesis fit analysis...
          </div>
        ) : aiExplanation ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 rounded-lg bg-accent/50 border border-border"
          >
            <div className="flex items-start gap-2">
              <Sparkles className="h-4 w-4 text-primary mt-0.5" />
              <p className="text-sm text-foreground">{aiExplanation}</p>
            </div>
          </motion.div>
        ) : (
          <div className="text-sm text-muted-foreground">
            Add criteria above to generate thesis fit analysis
          </div>
        )}
      </CardContent>
    </Card>
  );
}


