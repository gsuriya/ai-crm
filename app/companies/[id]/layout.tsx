"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
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
      <div className="border-b border-border bg-background px-6 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-foreground tracking-tight mb-3">
              {company.name}
            </h1>
            <div className="flex items-center gap-6 flex-wrap">
              {company.website || company.domain ? (
                <a
                  href={company.website || `https://${company.domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
                >
                  <span>{company.website || company.domain}</span>
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              ) : null}
              {company.location && (
                <span className="text-sm text-muted-foreground">
                  {company.location}
                </span>
              )}
              {lastTouchDays !== null && (
                <span className="text-sm text-muted-foreground">
                  Last touch: {lastTouchDays}d ago
                </span>
              )}
            </div>
          </div>
          
          {/* Badges Row */}
          <div className="flex items-center gap-2 flex-wrap mb-6">
            {company.stage && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                {company.stage}
              </span>
            )}
            {company.sectors && company.sectors.length > 0 && (
              <>
                {company.sectors.slice(0, 3).map((sector, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-muted/60 text-muted-foreground border border-border/50"
                  >
                    {sector}
                  </span>
                ))}
              </>
            )}
            {company.relationshipScore !== undefined && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                Score: {company.relationshipScore}/100
              </span>
            )}
            {company.owner && (
              <span className="text-xs text-muted-foreground">
                Owner: {company.owner}
              </span>
            )}
          </div>

          {/* Tab Navigation */}
          <CompanyTabs companyId={companyId} currentTab={currentTab} />
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto bg-background">{children}</div>
    </div>
  );
}


