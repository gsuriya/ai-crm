"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Company, ActivityItem, Deal } from "@/lib/types/company";
import { CompanyKeyMetrics } from "@/components/company/company-key-metrics";
import { TimelineSnapshot } from "@/components/company/timeline-snapshot";
import { ContactsSection } from "@/components/company/contacts-section";
import { DealState } from "@/components/company/deal-state";
import { RecentNews } from "@/components/company/recent-news";
import { CompanyDetails } from "@/components/company/company-details";
import { SimilarCompanies } from "@/components/company/similar-companies";

export const dynamic = 'force-dynamic';

export default function CompanyOverviewPage() {
  const params = useParams();
  const companyId = params.id as string;

  const [company, setCompany] = useState<Company | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [deal, setDeal] = useState<Deal | null>(null);
  const [loading, setLoading] = useState(true);

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
  }, [fetchCompanyData]);

  // Listen for company updates from child components
  useEffect(() => {
    const handleCompanyUpdate = () => {
      fetchCompanyData();
    };

    window.addEventListener('companyUpdated', handleCompanyUpdate);
    return () => {
      window.removeEventListener('companyUpdated', handleCompanyUpdate);
    };
  }, [fetchCompanyData]);

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

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="max-w-7xl mx-auto px-6 py-5">
        <div className="grid grid-cols-12 gap-6">
          {/* Center Column (col-span-8) */}
          <div className="col-span-12 lg:col-span-8 space-y-6">
            {/* Key Metrics */}
            <CompanyKeyMetrics companyId={companyId} />

            {/* Timeline Snapshot */}
            <TimelineSnapshot companyId={companyId} activities={activities} />

            {/* Contacts */}
            <ContactsSection companyId={companyId} company={company} />

            {/* Deal State */}
            {deal && <DealState deal={deal} />}
          </div>

          {/* Right Column (col-span-4) */}
          <div className="col-span-12 lg:col-span-4 space-y-6">
            {/* Company Details */}
            <CompanyDetails companyId={companyId} />

            {/* Recent News */}
            <RecentNews companyId={companyId} />

            {/* Similar Companies */}
            <SimilarCompanies companyId={companyId} />
          </div>
        </div>
      </div>
    </div>
  );
}


