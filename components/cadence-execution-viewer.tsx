"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mail, Phone, Clock, Play, MessageSquare, CheckCircle, Circle, Loader2, MessageCircle, FastForward, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FlowBlock {
  id: string;
  type: string;
  title: string;
  config?: {
    subject?: string;
    delayDays?: number;
    delayHours?: number;
    delayMinutes?: number;
    delaySeconds?: number;
    linkedinMessage?: string;
  };
  connections?: string[];
}

interface ExecutionData {
  id: string;
  current_block_id: string;
  status: string;
  scheduled_for?: string;
  metadata?: {
    executedBlockIds?: string[];
    paused_reason?: string;
    paused_at?: string;
  };
  created_at: string;
  updated_at: string;
}

interface Props {
  blocks: FlowBlock[];
  execution: ExecutionData | null;
  cadenceName?: string;
  contactName?: string;
  contactEmail?: string;
  responded: boolean;
  onClose: () => void;
  onRefresh?: () => void;
}

const blockIcons: Record<string, any> = {
  trigger: Play,
  email: Mail,
  voicecall: Phone,
  delay: Clock,
  linkedinmessage: MessageSquare,
};

const blockColors: Record<string, string> = {
  trigger: "bg-purple-500",
  email: "bg-blue-500",
  voicecall: "bg-orange-500",
  delay: "bg-yellow-500",
  linkedinmessage: "bg-indigo-500",
};

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return d + "d " + (h % 24) + "h " + (m % 60) + "m";
  if (h > 0) return h + "h " + (m % 60) + "m " + (s % 60) + "s";
  if (m > 0) return m + "m " + (s % 60) + "s";
  return s + "s";
}

function WaitTimer({ 
  scheduledFor, 
  config,
  executionId,
  onRefresh
}: { 
  scheduledFor?: string; 
  config?: FlowBlock["config"];
  executionId?: string;
  onRefresh?: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  const [adjusting, setAdjusting] = useState(false);
  
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);
  
  if (!scheduledFor) return null;
  
  const scheduledTime = new Date(scheduledFor).getTime();
  const remaining = scheduledTime - now;
  const totalMs =
    ((config?.delayDays || 0) * 86400000) +
    ((config?.delayHours || 0) * 3600000) +
    ((config?.delayMinutes || 0) * 60000) +
    ((config?.delaySeconds || 0) * 1000);
  const elapsed = totalMs - remaining;
  const progress = totalMs > 0 ? Math.min(100, (elapsed / totalMs) * 100) : 0;

  const handleSkipWait = async () => {
    if (!executionId) return;
    setAdjusting(true);
    try {
      const res = await fetch("/api/cadence/skip-wait", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ executionId }),
      });
      if (res.ok) {
        onRefresh?.();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to skip wait");
      }
    } catch (err) {
      console.error("Error skipping wait:", err);
    } finally {
      setAdjusting(false);
    }
  };

  const handleAdjustTime = async (adjustMs: number) => {
    if (!executionId) return;
    setAdjusting(true);
    try {
      const newScheduledFor = new Date(scheduledTime + adjustMs).toISOString();
      const res = await fetch("/api/cadence/adjust-wait", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ executionId, newScheduledFor }),
      });
      if (res.ok) {
        onRefresh?.();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to adjust wait time");
      }
    } catch (err) {
      console.error("Error adjusting wait:", err);
    } finally {
      setAdjusting(false);
    }
  };
  
  if (remaining <= 0) {
    return <div className="text-xs text-green-600 font-medium">Ready to continue</div>;
  }
  
  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>Elapsed: {formatDuration(elapsed > 0 ? elapsed : 0)}</span>
        <span>Remaining: {formatDuration(remaining)}</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-1.5">
        <motion.div
          className="bg-yellow-500 h-1.5 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: progress + "%" }}
          transition={{ duration: 0.5 }}
        />
      </div>
      
      {/* Wait adjustment controls */}
      <div className="flex items-center gap-2 mt-3 pt-2 border-t border-gray-200">
        <button
          onClick={handleSkipWait}
          disabled={adjusting}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors disabled:opacity-50"
        >
          <FastForward className="h-3.5 w-3.5" />
          Skip Wait
        </button>
        
        <div className="flex items-center gap-1 ml-auto">
          <span className="text-xs text-gray-500 mr-1">Adjust:</span>
          <button
            onClick={() => handleAdjustTime(-3600000)}
            disabled={adjusting}
            className="p-1.5 text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 rounded transition-colors disabled:opacity-50"
            title="Reduce by 1 hour"
          >
            <Minus className="h-3 w-3" />
          </button>
          <span className="text-xs text-gray-500">1h</span>
          <button
            onClick={() => handleAdjustTime(3600000)}
            disabled={adjusting}
            className="p-1.5 text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 rounded transition-colors disabled:opacity-50"
            title="Add 1 hour"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function CadenceExecutionViewer({
  blocks,
  execution,
  cadenceName = "Cadence",
  contactName,
  contactEmail,
  responded,
  onClose,
  onRefresh,
}: Props) {
  const executedBlockIds = execution?.metadata?.executedBlockIds || [];
  const currentBlockId = execution?.current_block_id;
  const isPaused = execution?.status === "paused";
  const isCompleted = execution?.status === "completed";
  const pausedDueToReply = execution?.metadata?.paused_reason === "email_reply_received";

  const getOrderedBlocks = (): FlowBlock[] => {
    const ordered: FlowBlock[] = [];
    const visited = new Set<string>();
    const trigger = blocks.find((b) => b.type === "trigger");
    if (!trigger) return blocks;

    const traverse = (id: string) => {
      if (visited.has(id)) return;
      visited.add(id);
      const block = blocks.find((b) => b.id === id);
      if (!block) return;
      ordered.push(block);
      if (block.connections) block.connections.forEach((c) => traverse(c));
    };

    traverse(trigger.id);
    blocks.forEach((b) => {
      if (!visited.has(b.id)) ordered.push(b);
    });
    return ordered;
  };

  const orderedBlocks = getOrderedBlocks();

  // Check if we're currently waiting (scheduled_for is in the future)
  const isCurrentlyWaiting = execution?.scheduled_for && new Date(execution.scheduled_for).getTime() > Date.now();
  
  // Find the delay block that precedes the current block
  const precedingDelayBlockId = isCurrentlyWaiting
    ? blocks.find((b) => b.type === "delay" && b.connections?.includes(currentBlockId || ""))?.id
    : null;

  const getBlockStatus = (block: FlowBlock): "completed" | "current" | "waiting" | "skipped" | "pending" => {
    // If we're in a wait period and this is the delay block before the current block, show it as "waiting"
    if (precedingDelayBlockId && block.id === precedingDelayBlockId) {
      return "waiting";
    }
    
    // If we're in a wait period and this is the "current" block (next action), show it as pending
    if (isCurrentlyWaiting && block.id === currentBlockId) {
      return "pending";
    }
    
    // Normal completed check - but exclude the preceding delay if we're still waiting
    if (executedBlockIds.includes(block.id) && block.id !== precedingDelayBlockId) {
      return "completed";
    }
    
    if (block.id === currentBlockId) {
      if (block.type === "delay" && execution?.scheduled_for) return "waiting";
      return "current";
    }
    if (pausedDueToReply) return "skipped";
    return "pending";
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{cadenceName}</h2>
            {contactName && <p className="text-sm text-gray-600">{contactName}{contactEmail ? " • " + contactEmail : ""}</p>}
          </div>
          <div className="flex items-center gap-3">
            {responded && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                <MessageCircle className="h-4 w-4" />
                Responded
              </div>
            )}
            {isPaused && !responded && (
              <div className="px-3 py-1.5 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium">
                Paused
              </div>
            )}
            {isCompleted && (
              <div className="px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                Completed
              </div>
            )}
            {!isPaused && !isCompleted && execution?.status === "active" && (
              <div className="px-3 py-1.5 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium">
                {isCurrentlyWaiting ? "Waiting" : "Active"}
              </div>
            )}
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(85vh-140px)]">
          {responded && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-full">
                  <MessageCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-medium text-green-800">Contact Responded!</h3>
                  <p className="text-sm text-green-600">
                    The cadence was automatically stopped because {contactName || "the contact"} replied to your email.
                    {execution?.metadata?.paused_at && (
                      <span className="block mt-1">
                        Responded on {new Date(execution.metadata.paused_at).toLocaleDateString()} at{" "}
                        {new Date(execution.metadata.paused_at).toLocaleTimeString()}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-0">
            {orderedBlocks.map((block, index) => {
              const status = getBlockStatus(block);
              const Icon = blockIcons[block.type] || Circle;
              const isWaiting = status === "waiting";
              const isLast = index === orderedBlocks.length - 1;

              return (
                <div key={block.id} className="relative">
                  {!isLast && (
                    <div
                      className={
                        "absolute left-6 top-12 w-0.5 h-8 " +
                        (status === "completed" ? "bg-green-300" : "bg-gray-200")
                      }
                    />
                  )}

                  <div
                    className={
                      "relative flex items-start gap-4 p-4 rounded-lg transition-all " +
                      (status === "completed"
                        ? "bg-green-50 border border-green-200"
                        : status === "current" || status === "waiting"
                        ? "bg-yellow-50 border border-yellow-200"
                        : status === "skipped"
                        ? "bg-gray-50 border border-gray-200 opacity-50"
                        : "bg-gray-50 border border-gray-200")
                    }
                  >
                    <div
                      className={
                        "flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center " +
                        (status === "completed"
                          ? "bg-green-500"
                          : status === "current" || status === "waiting"
                          ? "bg-yellow-500"
                          : "bg-gray-300")
                      }
                    >
                      {status === "completed" ? (
                        <CheckCircle className="h-6 w-6 text-white" />
                      ) : isWaiting ? (
                        <Loader2 className="h-6 w-6 text-white animate-spin" />
                      ) : (
                        <Icon className="h-6 w-6 text-white" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4
                          className={
                            "font-medium " + (status === "skipped" ? "text-gray-400" : "text-gray-900")
                          }
                        >
                          {block.title || block.type.charAt(0).toUpperCase() + block.type.slice(1)}
                        </h4>
                        {status === "current" && !isWaiting && (
                          <span className="px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">
                            In Progress
                          </span>
                        )}
                        {isWaiting && (
                          <span className="px-2 py-0.5 bg-yellow-500 text-white text-xs rounded-full">
                            Waiting
                          </span>
                        )}
                        {status === "skipped" && (
                          <span className="px-2 py-0.5 bg-gray-400 text-white text-xs rounded-full">
                            Skipped
                          </span>
                        )}
                      </div>

                      {block.type === "email" && block.config?.subject && (
                        <p
                          className={
                            "text-sm mt-1 " + (status === "skipped" ? "text-gray-400" : "text-gray-600")
                          }
                        >
                          Subject: {block.config.subject}
                        </p>
                      )}

                      {block.type === "delay" && (
                        <div>
                          <p
                            className={
                              "text-sm mt-1 " + (status === "skipped" ? "text-gray-400" : "text-gray-600")
                            }
                          >
                            Wait for:{" "}
                            {[
                              block.config?.delayDays && block.config.delayDays + "d",
                              block.config?.delayHours && block.config.delayHours + "h",
                              block.config?.delayMinutes && block.config.delayMinutes + "m",
                              block.config?.delaySeconds && block.config.delaySeconds + "s",
                            ]
                              .filter(Boolean)
                              .join(" ") || "0s"}
                          </p>
                          {isWaiting && (
                            <WaitTimer 
                              scheduledFor={execution?.scheduled_for} 
                              config={block.config}
                              executionId={execution?.id}
                              onRefresh={onRefresh}
                            />
                          )}
                        </div>
                      )}

                      {block.type === "linkedinmessage" && block.config?.linkedinMessage && (
                        <p
                          className={
                            "text-sm mt-1 truncate " +
                            (status === "skipped" ? "text-gray-400" : "text-gray-600")
                          }
                        >
                          Message: {block.config.linkedinMessage.substring(0, 50)}...
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div>
              {executedBlockIds.filter((id: string) => { const block = blocks.find(b => b.id === id); return block?.type === 'email'; }).length} of {blocks.filter(b => b.type === 'email').length} emails sent
            </div>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
