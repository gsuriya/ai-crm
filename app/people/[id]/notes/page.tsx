"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { NotesEditor } from "@/components/company/notes-editor";
import { CardSection } from "@/components/company/card-section";
import { Button } from "@/components/ui/button";
import { FileText, Plus, History } from "lucide-react";


interface Note {
  id: string;
  company_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
  version?: number;
  comments?: Array<{
    id: string;
    content: string;
    created_at: string;
    created_by: string;
  }>;
}

export default function CompanyNotesPage() {
  const params = useParams();
  const companyId = params.id as string;

  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [showVersionHistory, setShowVersionHistory] = useState(false);

  const fetchNotes = useCallback(async () => {
    if (!companyId) return;

    try {
      setLoading(true);

      // Fetch notes from company_content
      const { data, error } = await supabase
        .from("company_content")
        .select("*")
        .eq("company_id", companyId)
        .eq("content_type", "note")
        .order("updated_at", { ascending: false });

      if (error) throw error;

      const mappedNotes: Note[] = (data || []).map((note) => ({
        id: note.id,
        company_id: note.company_id,
        content: note.content,
        created_at: note.created_at,
        updated_at: note.updated_at,
        created_by: note.metadata?.created_by,
        updated_by: note.metadata?.updated_by,
        version: note.metadata?.version || 1,
        comments: note.metadata?.comments || [],
      }));

      setNotes(mappedNotes);
      if (mappedNotes.length > 0 && !selectedNote) {
        setSelectedNote(mappedNotes[0]);
      }
    } catch (error) {
      console.error("Error fetching notes:", error);
    } finally {
      setLoading(false);
    }
  }, [companyId, selectedNote]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const handleCreateNote = () => {
    const newNote: Note = {
      id: `new-${Date.now()}`,
      company_id: companyId,
      content: "",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      version: 1,
    };
    setNotes([newNote, ...notes]);
    setSelectedNote(newNote);
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">Loading notes...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <div>
            <h2 className="text-2xl font-bold text-foreground tracking-tight">Notes</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {notes.length} notes
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowVersionHistory(!showVersionHistory)}>
              <History className="h-4 w-4 mr-2" />
              History
            </Button>
            <Button size="sm" onClick={handleCreateNote}>
              <Plus className="h-4 w-4 mr-2" />
              New Note
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-12">
          {/* Notes List Sidebar */}
          <div className="col-span-12 lg:col-span-3">
            <div className="space-y-1">
              {notes.map((note) => (
                <div
                  key={note.id}
                  onClick={() => setSelectedNote(note)}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedNote?.id === note.id 
                      ? "bg-primary/10 text-foreground" 
                      : "hover:bg-muted/40 text-muted-foreground"
                  }`}
                >
                  <div className="text-sm font-medium line-clamp-2 mb-1">
                    {note.content.substring(0, 80) || "New Note"}
                    {note.content.length > 80 ? "..." : ""}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(note.updated_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
              {notes.length === 0 && (
                <div className="text-center py-12 text-sm text-muted-foreground">
                  No notes yet
                </div>
              )}
            </div>
          </div>

          {/* Notes Editor */}
          <div className="col-span-12 lg:col-span-9">
            {selectedNote ? (
              <NotesEditor
                note={selectedNote}
                companyId={companyId}
                onSave={fetchNotes}
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <FileText className="h-12 w-12 mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  No note selected
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Select a note or create a new one
                </p>
                <Button onClick={handleCreateNote}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Note
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


