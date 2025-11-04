"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Send, Sparkles, Loader2 } from "lucide-react";
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

interface DocQAProps {
  docs: Doc[];
  companyId: string;
  selectedDoc: Doc | null;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export function DocQA({ docs, companyId, selectedDoc }: DocQAProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAsk = async () => {
    if (!question.trim() || !selectedDoc) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: question,
      timestamp: new Date().toISOString(),
    };

    setMessages([...messages, userMessage]);
    setQuestion("");
    setLoading(true);

    try {
      // Call AI endpoint for doc Q&A
      const response = await fetch(`/api/ai/doc-qa?companyId=${companyId}&docId=${selectedDoc.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });

      if (response.ok) {
        const data = await response.json();
        const assistantMessage: Message = {
          id: `msg-${Date.now() + 1}`,
          role: "assistant",
          content: data.answer || "I couldn't find an answer to that question.",
          timestamp: new Date().toISOString(),
        };
        setMessages([...messages, userMessage, assistantMessage]);
      } else {
        // Mock response for now
        const assistantMessage: Message = {
          id: `msg-${Date.now() + 1}`,
          role: "assistant",
          content: "Based on the document, here's what I found: [Mock answer - replace with real AI]",
          timestamp: new Date().toISOString(),
        };
        setMessages([...messages, userMessage, assistantMessage]);
      }
    } catch (error) {
      console.error("Error asking question:", error);
      const errorMessage: Message = {
        id: `msg-${Date.now() + 1}`,
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date().toISOString(),
      };
      setMessages([...messages, userMessage, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  if (!selectedDoc) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        <Sparkles className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p>Select a document to ask questions</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Selected Doc */}
      <div className="p-3 rounded-lg bg-accent/50 border border-border">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="outline" className="text-xs">
            {selectedDoc.type?.toUpperCase() || "PDF"}
          </Badge>
          <span className="text-xs font-medium text-foreground truncate">
            {selectedDoc.file_name}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Ask questions about this document
        </p>
      </div>

      {/* Messages */}
      <div className="space-y-3 max-h-[400px] overflow-y-auto">
        {messages.length === 0 && (
          <div className="text-center py-8 text-sm text-muted-foreground">
            <Sparkles className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
            <p>Ask a question about {selectedDoc.file_name}</p>
          </div>
        )}
        {messages.map((message, index) => (
          <motion.div
            key={message.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`p-3 rounded-lg border border-border ${
              message.role === "user"
                ? "bg-primary/10 border-primary/20 ml-auto max-w-[80%]"
                : "bg-background"
            }`}
          >
            <div className="text-xs font-medium text-muted-foreground mb-1">
              {message.role === "user" ? "You" : "AI"}
            </div>
            <div className="text-sm text-foreground">{message.content}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {new Date(message.timestamp).toLocaleTimeString()}
            </div>
          </motion.div>
        ))}
        {loading && (
          <div className="p-3 rounded-lg bg-background border border-border">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Thinking...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 pt-4 border-t border-border">
        <Input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleAsk();
            }
          }}
          placeholder="Ask a question..."
          className="flex-1 text-sm"
          disabled={loading}
        />
        <Button size="sm" onClick={handleAsk} disabled={loading || !question.trim()}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}


