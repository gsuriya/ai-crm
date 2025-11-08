"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Company, ActivityItem, Deal } from "@/lib/types/company";
import { CompanyKeyMetrics } from "@/components/company/company-key-metrics";
import { TimelineSnapshot } from "@/components/company/timeline-snapshot";
import { ContactsSection } from "@/components/company/contacts-section";
import { DealState } from "@/components/company/deal-state";
import { CompanyDetails } from "@/components/company/company-details";
import { KpiStrip } from "@/components/company/kpi-strip";
import { CardSection } from "@/components/company/card-section";
import Link from "next/link";

export default function CompanyOverviewPage() {
  const params = useParams();
  const companyId = params.id as string;

  const [company, setCompany] = useState<Company | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [deal, setDeal] = useState<Deal | null>(null);
  const [loading, setLoading] = useState(true);
  const [financials, setFinancials] = useState<any>(null);
  const router = useRouter();

  const fetchCompanyData = useCallback(async () => {
    if (!companyId) return;

    try {
      setLoading(true);

      // Fetch company
      const { data: companyData, error: companyError } = await supabase
        .from("companies")
        .select("*")
        .eq("id", companyId)
        .single();

      if (companyError) throw companyError;
      setCompany(companyData as Company);

      // Fetch latest financials for KPI strip
      const { data: financialsData } = await supabase
        .from("company_financials")
        .select("*")
        .eq("company_id", companyId)
        .order("year", { ascending: false })
        .order("month", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      
      if (financialsData) {
        setFinancials(financialsData);
      }

      // Fetch email logs (both sent and received)
      const { data: emailLogs } = await supabase
        .from("email_logs")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(10);

      // Fetch call logs with summaries
      const { data: callLogs } = await supabase
        .from("call_logs")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(10);

      // Combine and format activities
      const allActivities: ActivityItem[] = [
        ...(emailLogs?.map((log) => ({
          id: log.id,
          type: 'email' as const,
          date: log.sent_at || log.received_at || log.created_at,
          summary: log.direction === 'sent' 
            ? `Sent: ${log.subject || 'Email'}` 
            : `Received: ${log.subject || 'Email'}`,
          body: log.body ? (log.body.length > 200 ? log.body.substring(0, 200) + '...' : log.body) : '',
          company_id: log.company_id,
          created_at: log.created_at,
          metadata: {
            direction: log.direction,
            from_email: log.from_email,
            to_email: log.to_email,
          },
        })) || []),
        ...(callLogs?.map((call) => ({
          id: call.id,
          type: 'call' as const,
          date: call.created_at,
          summary: call.call_type === 'voice_call' 
            ? 'Voice Call' 
            : 'Voicemail',
          body: call.notes || call.transcription 
            ? (call.notes || call.transcription || '').substring(0, 200) + ((call.notes || call.transcription || '').length > 200 ? '...' : '')
            : 'Call completed',
          company_id: call.company_id,
          created_at: call.created_at,
          metadata: {
            call_type: call.call_type,
            duration: call.duration_seconds,
            has_transcription: !!call.transcription,
            has_summary: !!call.notes,
          },
        })) || []),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);

      setActivities(allActivities);

      // Fetch deal if exists
      const { data: dealData } = await supabase
        .from("opportunities")
        .select("*")
        .eq("company_id", companyId)
        .single();

      if (dealData) {
        setDeal({
          id: dealData.id,
          company_id: dealData.company_id,
          name: dealData.name,
          stage: dealData.stage,
          amount: dealData.amount,
          probability: dealData.probability,
          closeDate: dealData.close_date,
          blockers: [],
          created_at: dealData.created_at,
          updated_at: dealData.updated_at,
        });
      }
    } catch (error) {
      console.error("Error fetching company data:", error);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchCompanyData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  // Listen for company updates from child components
  useEffect(() => {
    const handleCompanyUpdate = () => {
      fetchCompanyData();
    };

    window.addEventListener('companyUpdated', handleCompanyUpdate);
    return () => {
      window.removeEventListener('companyUpdated', handleCompanyUpdate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">Loading company overview...</div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <div className="text-muted-foreground">Company not found</div>
      </div>
    );
  }

  const formatCurrency = (value?: number | null) => {
    if (!value) return "—";
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  const formatLastActivity = () => {
    if (activities.length === 0) return "No activity";
    const latest = activities[0];
    const date = new Date(latest.date);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const kpiItems = [
    {
      label: "ARR",
      value: financials?.arr ? formatCurrency(financials.arr) : "—",
      onClick: () => router.push(`/companies/${companyId}/financials`),
    },
    {
      label: "Burn Rate",
      value: financials?.burn ? formatCurrency(financials.burn) : "—",
      onClick: () => router.push(`/companies/${companyId}/financials`),
    },
    {
      label: "Employees",
      value: company?.employee_count ? company.employee_count.toLocaleString() : "—",
    },
    {
      label: "Funding",
      value: company?.funding_amount ? formatCurrency(company.funding_amount) : "—",
    },
    {
      label: "Last Activity",
      value: formatLastActivity(),
      onClick: () => router.push(`/companies/${companyId}/activity`),
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* KPI Strip */}
        <div className="mb-12">
          <KpiStrip items={kpiItems} />
        </div>

        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
          {/* Main Content */}
          <main className="lg:col-span-8 space-y-12">
            {/* Activity Section */}
            <CardSection
              title="Activity"
              action={
                <Link
                  href={`/companies/${companyId}/activity`}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  View all
                </Link>
              }
            >
              <TimelineSnapshot companyId={companyId} activities={activities} />
            </CardSection>

            {/* Contacts Section */}
            <CardSection
              title="People"
              action={
                <Link
                  href={`/companies/${companyId}/people`}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  View all
                </Link>
              }
            >
              <ContactsSection companyId={companyId} company={company} />
            </CardSection>

            {/* Financials Section */}
            <CardSection
              title="Financials"
              action={
                <Link
                  href={`/companies/${companyId}/financials`}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  View all
                </Link>
              }
            >
              <CompanyKeyMetrics companyId={companyId} />
            </CardSection>

            {/* Deal State */}
            {deal && (
              <CardSection title="Deal">
                <DealState deal={deal} />
              </CardSection>
            )}
          </main>

          {/* Sidebar */}
          <aside className="lg:col-span-4 space-y-12">
            {/* Company Details */}
            <CardSection title="Details">
              <CompanyDetails companyId={companyId} />
            </CardSection>
          </aside>
        </div>
      </div>
    </div>
  );
}


