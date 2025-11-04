"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { DocsLibrary } from "@/components/company/docs-library";
import { DocQA } from "@/components/company/doc-qa";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileUp, Upload, Search } from "lucide-react";

export const dynamic = 'force-dynamic';

interface Doc {
  id: string;
  company_id: string;
  file_name: string;
  file_url: string;
  file_size?: number;
  uploaded_by?: string;
  uploaded_at: string;
  version?: number;
  notes?: string;
  type?: string;
}

export default function CompanyDocsPage() {
  const params = useParams();
  const companyId = params.id as string;

  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState<Doc | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const fetchDocs = useCallback(async () => {
    if (!companyId) return;

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("company_pitch_decks")
        .select("*")
        .eq("company_id", companyId)
        .order("uploaded_at", { ascending: false });

      if (error) throw error;

      const mappedDocs: Doc[] = (data || []).map((doc) => ({
        id: doc.id,
        company_id: doc.company_id,
        file_name: doc.file_name,
        file_url: doc.file_url,
        file_size: doc.file_size,
        uploaded_by: doc.uploaded_by,
        uploaded_at: doc.uploaded_at,
        version: doc.version || 1,
        notes: doc.notes,
        type: doc.file_name.split(".").pop()?.toLowerCase() || "pdf",
      }));

      setDocs(mappedDocs);
    } catch (error) {
      console.error("Error fetching docs:", error);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  const handleUpload = async (file: File) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Upload to Supabase Storage
      const fileExt = file.name.split(".").pop();
      const fileName = `${companyId}/${Date.now()}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("pitch-decks")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("pitch-decks")
        .getPublicUrl(fileName);

      // Save to database
      const { error: dbError } = await supabase
        .from("company_pitch_decks")
        .insert({
          company_id: companyId,
          file_name: file.name,
          file_url: urlData.publicUrl,
          file_size: file.size,
          uploaded_by: user.id,
        });

      if (dbError) throw dbError;

      setShowUploadModal(false);
      fetchDocs();
    } catch (error: any) {
      console.error("Error uploading doc:", error);
      alert(`Error uploading document: ${error.message}`);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">Loading documents...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="max-w-7xl mx-auto px-6 py-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Documents</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Document library with inline preview, AI doc Q&A, and deck parser
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}>
              {viewMode === "grid" ? "List" : "Grid"}
            </Button>
            <Button size="sm" onClick={() => setShowUploadModal(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Upload Document
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Docs Library */}
          <div className="col-span-12 lg:col-span-8">
            <Card className="rounded-2xl shadow-sm border border-border p-5">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold text-foreground">
                  Document Library
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  {docs.length} documents • Grid + list view with facets
                </p>
              </CardHeader>
              <CardContent>
                <DocsLibrary
                  docs={docs}
                  viewMode={viewMode}
                  onSelectDoc={setSelectedDoc}
                  selectedDoc={selectedDoc}
                />
              </CardContent>
            </Card>
          </div>

          {/* Doc Q&A */}
          <div className="col-span-12 lg:col-span-4">
            <Card className="rounded-2xl shadow-sm border border-border p-5">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-primary" />
                  <CardTitle className="text-lg font-semibold text-foreground">
                    AI Doc Q&A
                  </CardTitle>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Ask questions about uploaded documents
                </p>
              </CardHeader>
              <CardContent>
                <DocQA
                  docs={docs}
                  companyId={companyId}
                  selectedDoc={selectedDoc}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Upload Modal */}
        {showUploadModal && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowUploadModal(false)}
          >
            <div
              className="bg-background border border-border rounded-lg p-6 max-w-md w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold mb-4">Upload Document</h3>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.ppt,.pptx"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleUpload(file);
                    setShowUploadModal(false);
                  }
                }}
                className="w-full p-2 border rounded"
              />
              <div className="flex items-center gap-2 mt-4 justify-end">
                <Button variant="outline" onClick={() => setShowUploadModal(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

