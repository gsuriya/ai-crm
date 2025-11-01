"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, FileText, Tag } from "lucide-react";
import { motion } from "framer-motion";
import { MatchIndicator } from "@/components/match-indicator";
import { MatchSnippet } from "@/components/match-snippet";

export const dynamic = 'force-dynamic';

interface Company {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  arr?: number;
  funding_amount?: number;
}

interface CompanyContent {
  id: string;
  company_id: string;
  content_type: string;
  content: string;
  source?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

interface CompanyMetadata {
  id: string;
  company_id: string;
  key: string;
  value: string;
  created_at: string;
}

export default function CompanyDetailPage() {
  const params = useParams();
  const companyId = params.id as string;
  const [company, setCompany] = useState<Company | null>(null);
  const [content, setContent] = useState<CompanyContent[]>([]);
  const [metadata, setMetadata] = useState<CompanyMetadata[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCompany = useCallback(async () => {
    if (!companyId) return;
    
    try {
      setLoading(true);
      const [companyResult, contentResult, metadataResult] = await Promise.all([
        supabase
          .from("companies")
          .select("*")
          .eq("id", companyId)
          .single(),
        supabase
          .from("company_content")
          .select("*")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false }),
        supabase
          .from("company_metadata")
          .select("*")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false }),
      ]);

      if (companyResult.error) throw companyResult.error;
      setCompany(companyResult.data);

      if (contentResult.data) {
        setContent(contentResult.data);
      }

      if (metadataResult.data) {
        setMetadata(metadataResult.data);
      }
    } catch (error) {
      console.error("Error fetching company:", error);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchCompany();
  }, [fetchCompany]);

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

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border bg-background px-8 py-6">
        <Link href="/companies">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Companies
          </Button>
        </Link>
        <h1 className="text-3xl font-semibold text-foreground">{company.name}</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Company Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Company Name
                  </label>
                  <p className="mt-1 text-sm text-foreground">{company.name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Created At
                  </label>
                  <p className="mt-1 text-sm text-foreground">
                    {new Date(company.created_at).toLocaleString()}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Last Updated
                  </label>
                  <p className="mt-1 text-sm text-foreground">
                    {new Date(company.updated_at).toLocaleString()}
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Email Thread</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Email thread functionality coming soon...
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Documents</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Document management coming soon...
                </p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Meeting Logs & Content */}
          {content.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Meeting Logs & Content ({content.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {content.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-lg border border-border bg-accent/20 p-4"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <MatchIndicator
                            contentType={item.content_type}
                            source={item.source}
                          />
                          {item.metadata?.title && (
                            <span className="text-sm font-medium text-foreground">
                              {item.metadata.title}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(item.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-foreground whitespace-pre-wrap">
                        {item.content}
                      </p>
                      {item.source && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Source: {item.source}
                        </p>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Metadata */}
          {metadata.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Tag className="h-5 w-5" />
                    Company Metadata ({metadata.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {metadata.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-lg border border-border bg-accent/20 p-4"
                      >
                        <div className="text-sm font-medium text-muted-foreground uppercase">
                          {item.key}
                        </div>
                        <div className="mt-1 text-sm font-semibold text-foreground">
                          {item.value}
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">
                          Added {new Date(item.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Notes Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Add custom notes about this company...
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

