"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { NotesEditor } from "@/components/company/notes-editor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Plus, History, MessageSquare } from "lucide-react";

export const dynamic = 'force-dynamic';

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
      <div className="max-w-7xl mx-auto px-6 py-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Notes</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Notion-like, fast rich text editor with templates and AI actions
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowVersionHistory(!showVersionHistory)}>
              <History className="h-4 w-4 mr-2" />
              Version History
            </Button>
            <Button size="sm" onClick={handleCreateNote}>
              <Plus className="h-4 w-4 mr-2" />
              New Note
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Notes List Sidebar */}
          <div className="col-span-12 lg:col-span-3">
            <Card className="rounded-2xl shadow-sm border border-border p-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-foreground">
                  Notes ({notes.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {notes.map((note) => (
                    <div
                      key={note.id}
                      onClick={() => setSelectedNote(note)}
                      className={`p-3 rounded-lg border border-border cursor-pointer hover:bg-accent/50 transition-colors ${
                        selectedNote?.id === note.id ? "bg-accent border-primary" : "bg-background"
                      }`}
                    >
                      <div className="text-xs font-medium text-foreground line-clamp-2 mb-1">
                        {note.content.substring(0, 100) || "New Note"}
                        {note.content.length > 100 ? "..." : ""}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(note.updated_at).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                  {notes.length === 0 && (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      No notes yet. Create one to get started.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
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
              <Card className="rounded-2xl shadow-sm border border-border p-12">
                <div className="text-center">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    No note selected
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Select a note from the sidebar or create a new one
                  </p>
                  <Button onClick={handleCreateNote}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Note
                  </Button>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


