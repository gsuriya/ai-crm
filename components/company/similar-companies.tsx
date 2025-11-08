"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, ArrowRight, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";

interface SimilarCompaniesProps {
  companyId: string;
}

interface SimilarCompany {
  id: string;
  name: string;
  reason: string;
  similarity: number; // 0-100
}

export function SimilarCompanies({ companyId }: SimilarCompaniesProps) {
  const [companies, setCompanies] = useState<SimilarCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompare, setShowCompare] = useState(false);

  useEffect(() => {
    fetchSimilarCompanies();
  }, [companyId]);

  const fetchSimilarCompanies = async () => {
    try {
      setLoading(true);
      // Call AI endpoint for similar companies
      const response = await fetch(`/api/ai/lookalikes?companyId=${companyId}`);
      if (response.ok) {
        const data = await response.json();
        setCompanies(data.companies || []);
      } else {
        // Mock data for now
        setCompanies([
          {
            id: "1",
            name: "Company A",
            reason: "Shared GTM strategy",
            similarity: 85,
          },
          {
            id: "2",
            name: "Company B",
            reason: "Same buyer persona",
            similarity: 78,
          },
          {
            id: "3",
            name: "Company C",
            reason: "Similar market size",
            similarity: 72,
          },
        ]);
      }
    } catch (error) {
      console.error("Error fetching similar companies:", error);
      // Mock data on error
      setCompanies([
        {
          id: "1",
          name: "Company A",
          reason: "Shared GTM strategy",
          similarity: 85,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-5 bg-muted rounded w-1/2"></div>
          <div className="h-16 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (companies.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-muted-foreground">
          {companies.length} lookalikes
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowCompare(!showCompare)}
          className="text-xs"
        >
          {showCompare ? "Hide Compare" : "Compare"}
        </Button>
      </div>
      <div className="space-y-3">
        {companies.map((company, index) => (
          <motion.div
            key={company.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="p-4 rounded-xl bg-muted/20 hover:bg-muted/40 transition-all duration-200"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2 flex-1">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <Link
                  href={`/companies/${company.id}/overview`}
                  className="text-sm font-semibold text-foreground hover:text-primary"
                >
                  {company.name}
                </Link>
                <Badge variant="outline" className="text-xs ml-auto">
                  {company.similarity}% match
                </Badge>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-2">
              {company.reason}
            </p>
            {showCompare && (
              <div className="pt-2 border-t border-border">
                <Button variant="ghost" size="sm" className="text-xs h-7">
                  <ArrowRight className="h-3 w-3 mr-1" />
                  Compare Details
                </Button>
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}


