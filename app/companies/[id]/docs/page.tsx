"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { DocsLibrary } from "@/components/company/docs-library";
import { DocQA } from "@/components/company/doc-qa";
import { CardSection } from "@/components/company/card-section";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";


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
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <div>
            <h2 className="text-2xl font-bold text-foreground tracking-tight">Documents</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {docs.length} documents
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}>
              {viewMode === "grid" ? "List" : "Grid"}
            </Button>
            <Button size="sm" onClick={() => setShowUploadModal(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Upload
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-12">
          {/* Docs Library */}
          <div className="col-span-12 lg:col-span-8">
            <CardSection title="Documents">
              <DocsLibrary
                docs={docs}
                viewMode={viewMode}
                onSelectDoc={setSelectedDoc}
                selectedDoc={selectedDoc}
              />
            </CardSection>
          </div>

          {/* Doc Q&A */}
          <div className="col-span-12 lg:col-span-4">
            <CardSection title="AI Q&A">
              <DocQA
                docs={docs}
                companyId={companyId}
                selectedDoc={selectedDoc}
              />
            </CardSection>
          </div>
        </div>

        {/* Upload Modal */}
        {showUploadModal && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm"
            onClick={() => setShowUploadModal(false)}
          >
            <div
              className="bg-background border border-border/50 rounded-xl p-6 max-w-md w-full mx-4 shadow-lg transition-all duration-200"
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

