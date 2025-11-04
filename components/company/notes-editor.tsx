"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, Sparkles, FileText, History, MessageSquare, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";

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

interface NotesEditorProps {
  note: Note;
  companyId: string;
  onSave: () => void;
}

export function NotesEditor({ note, companyId, onSave }: NotesEditorProps) {
  const [content, setContent] = useState(note.content);
  const [saving, setSaving] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showAIActions, setShowAIActions] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState(note.comments || []);
  const [newComment, setNewComment] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setContent(note.content);
    setComments(note.comments || []);
  }, [note]);

  // Handle slash commands
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement === textareaRef.current) {
        setShowTemplates(true);
      }
    };

    const textarea = textareaRef.current;
    if (textarea) {
      textarea.addEventListener("keydown", handleKeyDown);
      return () => textarea.removeEventListener("keydown", handleKeyDown);
    }
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("company_content")
        .upsert(
          {
            id: note.id.startsWith("new-") ? undefined : note.id,
            company_id: companyId,
            content_type: "note",
            content: content,
            metadata: {
              created_by: note.created_by || user.id,
              updated_by: user.id,
              version: (note.version || 1) + 1,
              comments: comments,
            },
          },
          { onConflict: "id" }
        );

      if (error) throw error;

      onSave();
    } catch (error: any) {
      console.error("Error saving note:", error);
      alert(`Error saving note: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleTemplate = (template: string) => {
    setContent(content + "\n\n" + template);
    setShowTemplates(false);
  };

  const handleAIAction = async (action: string) => {
    try {
      // Call AI endpoint for note actions
      const response = await fetch(`/api/ai/note-action?companyId=${companyId}&action=${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.result) {
          setContent(data.result);
        }
      }
    } catch (error) {
      console.error("Error performing AI action:", error);
    }
    setShowAIActions(false);
  };

  const handleAddComment = () => {
    if (!newComment.trim()) return;

    const { data: { user } } = supabase.auth.getUser().then(({ data }) => {
      const comment = {
        id: `comment-${Date.now()}`,
        content: newComment,
        created_at: new Date().toISOString(),
        created_by: data.user?.id || "anonymous",
      };
      setComments([...comments, comment]);
      setNewComment("");
    });
  };

  const templates = [
    {
      name: "Meeting Notes",
      template: "# Meeting Notes\n\n## Attendees\n- \n\n## Agenda\n- \n\n## Action Items\n- \n",
    },
    {
      name: "Call Summary",
      template: "# Call Summary\n\n## Key Points\n- \n\n## Next Steps\n- \n",
    },
    {
      name: "Diligence",
      template: "# Diligence Notes\n\n## Market\n- \n\n## Product\n- \n\n## Team\n- \n",
    },
  ];

  const aiActions = [
    { name: "Extract Action Items", action: "extract-actions" },
    { name: "Summarize", action: "summarize" },
    { name: "Highlight Key Points", action: "highlight" },
    { name: "Improve Writing", action: "improve" },
  ];

  return (
    <Card className="rounded-2xl shadow-sm border border-border p-5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <CardTitle className="text-lg font-semibold text-foreground">
              {note.id.startsWith("new-") ? "New Note" : "Note"}
            </CardTitle>
            {note.version && (
              <Badge variant="outline" className="text-xs">
                v{note.version}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowAIActions(!showAIActions)}>
              <Sparkles className="h-4 w-4 mr-2" />
              AI Actions
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowComments(!showComments)}>
              <MessageSquare className="h-4 w-4 mr-2" />
              Comments ({comments.length})
            </Button>
            <Button variant="ghost" size="sm">
              <History className="h-4 w-4 mr-2" />
              History
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          Last updated: {new Date(note.updated_at).toLocaleString()}
          {note.updated_by && ` • Updated by: ${note.updated_by}`}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Templates Dropdown */}
        {showTemplates && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 rounded-lg border border-border bg-background shadow-lg"
          >
            <div className="text-xs font-medium text-foreground mb-2">Templates</div>
            <div className="space-y-1">
              {templates.map((template) => (
                <Button
                  key={template.name}
                  variant="ghost"
                  size="sm"
                  onClick={() => handleTemplate(template.template)}
                  className="w-full justify-start text-xs h-8"
                >
                  {template.name}
                </Button>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowTemplates(false)}
              className="w-full mt-2 text-xs h-7"
            >
              <X className="h-3 w-3 mr-1" />
              Close
            </Button>
          </motion.div>
        )}

        {/* AI Actions Dropdown */}
        {showAIActions && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 rounded-lg border border-border bg-background shadow-lg"
          >
            <div className="text-xs font-medium text-foreground mb-2">AI Actions</div>
            <div className="space-y-1">
              {aiActions.map((action) => (
                <Button
                  key={action.name}
                  variant="ghost"
                  size="sm"
                  onClick={() => handleAIAction(action.action)}
                  className="w-full justify-start text-xs h-8"
                >
                  <Sparkles className="h-3 w-3 mr-2" />
                  {action.name}
                </Button>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAIActions(false)}
              className="w-full mt-2 text-xs h-7"
            >
              <X className="h-3 w-3 mr-1" />
              Close
            </Button>
          </motion.div>
        )}

        {/* Editor */}
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Type '/' for templates, or start writing..."
          className="min-h-[400px] font-mono text-sm"
        />

        {/* Comments Section */}
        {showComments && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="pt-4 border-t border-border space-y-3"
          >
            <div className="text-sm font-semibold text-foreground">Comments</div>
            <div className="space-y-2">
              {comments.map((comment) => (
                <div key={comment.id} className="p-3 rounded-lg bg-muted/50 border border-border">
                  <div className="text-xs text-muted-foreground mb-1">
                    {comment.created_by} • {new Date(comment.created_at).toLocaleString()}
                  </div>
                  <div className="text-sm text-foreground">{comment.content}</div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                className="flex-1 text-sm"
                rows={2}
              />
              <Button size="sm" onClick={handleAddComment}>
                <MessageSquare className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}


