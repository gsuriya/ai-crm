"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { AIInsightsPanel } from "@/components/company/ai-insights-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

export const dynamic = 'force-dynamic';

export default function CompanyAIInsightsPage() {
  const params = useParams();
  const companyId = params.id as string;

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(false);
  }, [companyId]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">Loading AI insights...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="max-w-7xl mx-auto px-6 py-5">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold text-foreground">AI Insights</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Packaged AI modules (explainable & actionable)
          </p>
        </div>

        {/* AI Insights Panel */}
        <AIInsightsPanel companyId={companyId} />
      </div>
    </div>
  );
}


