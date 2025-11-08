"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, File, Download, Eye, MoreVertical, Grid, List, FileUp } from "lucide-react";
import { EmptyState } from "./empty-state";
import { motion } from "framer-motion";

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

interface DocsLibraryProps {
  docs: Doc[];
  viewMode: "grid" | "list";
  onSelectDoc: (doc: Doc | null) => void;
  selectedDoc: Doc | null;
}

export function DocsLibrary({ docs, viewMode, onSelectDoc, selectedDoc }: DocsLibraryProps) {
  const [facets, setFacets] = useState({
    type: "all" as "all" | "pdf" | "doc" | "ppt",
    dateRange: "all" as "all" | "7d" | "30d" | "90d",
  });

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "—";
    if (bytes >= 1000000) return `${(bytes / 1000000).toFixed(2)} MB`;
    if (bytes >= 1000) return `${(bytes / 1000).toFixed(2)} KB`;
    return `${bytes} B`;
  };

  const getFileIcon = (type?: string) => {
    switch (type) {
      case "pdf":
        return FileText;
      case "doc":
      case "docx":
        return File;
      case "ppt":
      case "pptx":
        return File;
      default:
        return FileText;
    }
  };

  const filteredDocs = docs.filter((doc) => {
    if (facets.type !== "all" && doc.type !== facets.type) return false;
    if (facets.dateRange !== "all") {
      const days = facets.dateRange === "7d" ? 7 : facets.dateRange === "30d" ? 30 : 90;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      if (new Date(doc.uploaded_at) < cutoff) return false;
    }
    return true;
  });

  if (docs.length === 0) {
    return (
      <EmptyState
        icon={FileUp}
        title="No documents yet"
        description="Upload pitch decks, financial documents, and more."
        actionLabel="Upload Document"
        onAction={() => {
          // TODO: Open upload modal
        }}
      />
    );
  }

  if (viewMode === "grid") {
    return (
      <div className="space-y-4">
        {/* Facets */}
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={facets.type}
            onChange={(e) => setFacets({ ...facets, type: e.target.value as any })}
            className="text-xs border border-border rounded px-2 py-1 bg-background"
          >
            <option value="all">All Types</option>
            <option value="pdf">PDF</option>
            <option value="doc">DOC</option>
            <option value="ppt">PPT</option>
          </select>
          <select
            value={facets.dateRange}
            onChange={(e) => setFacets({ ...facets, dateRange: e.target.value as any })}
            className="text-xs border border-border rounded px-2 py-1 bg-background"
          >
            <option value="all">All Time</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
        </div>

        {/* Grid View */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocs.map((doc, index) => {
            const Icon = getFileIcon(doc.type);

            return (
              <motion.div
                key={doc.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => onSelectDoc(doc)}
                className={`p-4 rounded-lg border border-border cursor-pointer hover:shadow-md transition-all ${
                  selectedDoc?.id === doc.id ? "ring-2 ring-primary bg-accent" : "bg-background hover:bg-accent/50"
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <MoreVertical className="h-3 w-3" />
                  </Button>
                </div>
                <div className="mb-2">
                  <div className="text-sm font-semibold text-foreground line-clamp-2 mb-1">
                    {doc.file_name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatFileSize(doc.file_size)}
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Button variant="ghost" size="sm" className="h-7 text-xs">
                    <Eye className="h-3 w-3 mr-1" />
                    Preview
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs">
                    <Download className="h-3 w-3 mr-1" />
                    Download
                  </Button>
                </div>
                {doc.version && (
                  <Badge variant="outline" className="text-xs mt-2">
                    v{doc.version}
                  </Badge>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    );
  }

  // List View
  return (
    <div className="space-y-4">
      {/* Facets */}
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={facets.type}
          onChange={(e) => setFacets({ ...facets, type: e.target.value as any })}
          className="text-xs border border-border rounded px-2 py-1 bg-background"
        >
          <option value="all">All Types</option>
          <option value="pdf">PDF</option>
          <option value="doc">DOC</option>
          <option value="ppt">PPT</option>
        </select>
        <select
          value={facets.dateRange}
          onChange={(e) => setFacets({ ...facets, dateRange: e.target.value as any })}
          className="text-xs border border-border rounded px-2 py-1 bg-background"
        >
          <option value="all">All Time</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
        </select>
      </div>

      {/* List View */}
      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-foreground">Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-foreground">Type</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-foreground">Size</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-foreground">Uploaded</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredDocs.map((doc) => {
              const Icon = getFileIcon(doc.type);

              return (
                <tr
                  key={doc.id}
                  onClick={() => onSelectDoc(doc)}
                  className={`hover:bg-accent/50 transition-colors cursor-pointer ${
                    selectedDoc?.id === doc.id ? "bg-accent" : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">{doc.file_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="text-xs">
                      {doc.type?.toUpperCase() || "PDF"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {formatFileSize(doc.file_size)}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {new Date(doc.uploaded_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                        <Eye className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                        <Download className="h-3 w-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}


