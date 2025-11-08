"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileText,
  Plus,
  Mail,
  Phone,
  Calendar,
  Settings,
  Upload,
  DollarSign,
  FileUp,
  Sparkles,
  Workflow,
  User,
  History,
} from "lucide-react";
import type { Company } from "@/lib/types/company";
import { CompanyTabs } from "@/components/company/company-tabs";

export default function CompanyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const companyId = params.id as string;

  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCompany = useCallback(async () => {
    if (!companyId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .eq("id", companyId)
        .single();

      if (error) throw error;
      setCompany(data as Company);
    } catch (error) {
      console.error("Error fetching company:", error);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchCompany();
  }, [fetchCompany]);

  // Listen for company updates from child components
  useEffect(() => {
    const handleCompanyUpdate = () => {
      fetchCompany();
    };

    window.addEventListener('companyUpdated', handleCompanyUpdate);
    return () => {
      window.removeEventListener('companyUpdated', handleCompanyUpdate);
    };
  }, [fetchCompany]);

  // Redirect /companies/[id] to /companies/[id]/overview
  useEffect(() => {
    if (pathname === `/companies/${companyId}`) {
      router.replace(`/companies/${companyId}/overview`);
    }
  }, [pathname, companyId, router]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">Loading company details...</div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <div className="text-muted-foreground">Company not found</div>
        <Link href="/companies">
          <Button variant="outline" className="mt-4">
            Back to Companies
          </Button>
        </Link>
      </div>
    );
  }

  // Calculate last touch days
  const lastTouchDays = company.lastTouchAt
    ? Math.floor(
        (Date.now() - new Date(company.lastTouchAt).getTime()) /
          (1000 * 60 * 60 * 24)
      )
    : null;

  // Get current tab from pathname
  const currentTab = pathname.split("/").pop() || "overview";

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header Bar */}
      <div className="border-b border-border bg-background px-6 py-5">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-2xl font-semibold text-foreground">
                  {company.name}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {company.website || company.domain || "No website"}
                </p>
              </div>
              {company.stage && (
                <span className="px-2 py-1 rounded-md bg-accent text-accent-foreground text-xs font-medium">
                  {company.stage}
                </span>
              )}
              {company.sectors && company.sectors.length > 0 && (
                <div className="flex gap-1">
                  {company.sectors.slice(0, 3).map((sector, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 rounded-md bg-muted text-muted-foreground text-xs"
                    >
                      {sector}
                    </span>
                  ))}
                </div>
              )}
              {company.location && (
                <span className="text-sm text-muted-foreground">
                  📍 {company.location}
                </span>
              )}
              {company.owner && (
                <span className="text-sm text-muted-foreground">
                  Owner: {company.owner}
                </span>
              )}
              {lastTouchDays !== null && (
                <span className="text-sm text-muted-foreground">
                  Last touch: {lastTouchDays}d ago
                </span>
              )}
              {company.relationshipScore !== undefined && (
                <span className="px-2 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium">
                  Score: {company.relationshipScore}/100
                </span>
              )}
            </div>
          </div>

          {/* Tab Navigation */}
          <CompanyTabs companyId={companyId} currentTab={currentTab} />
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}


