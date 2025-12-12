"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, 
  Mail, 
  Phone, 
  Clock, 
  Play, 
  MessageSquare, 
  CheckCircle, 
  Circle, 
  Loader2, 
  MessageCircle, 
  FastForward, 
  Minus, 
  Plus,
  ChevronDown,
  ChevronRight,
  Calendar,
  Send,
  Reply,
  ExternalLink,
  Copy,
  Check,
  AlertCircle,
  Zap,
  User,
  Building2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

interface FlowBlock {
  id: string;
  type: string;
  title: string;
  config?: {
    subject?: string;
    body?: string;
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
  company_cadence_id: string;
  current_block_id: string;
  status: string;
  scheduled_for?: string;
  metadata?: {
    executedBlockIds?: string[];
    paused_reason?: string;
    paused_at?: string;
    threadInfoMap?: Record<string, any>;
  };
  created_at: string;
  updated_at: string;
}

interface EmailLog {
  id: string;
  subject: string;
  body?: string;
  sent_at: string;
  direction: string;
  thread_id?: string;
  message_id?: string;
}

interface Props {
  blocks: FlowBlock[];
  execution: ExecutionData | null;
  cadenceName?: string;
  contactName?: string;
  contactEmail?: string;
  companyName?: string;
  responded: boolean;
  onClose: () => void;
  onRefresh?: () => void;
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function formatDate(date: string | Date) {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
  });
}

function formatTime(date: string | Date) {
  const d = new Date(date);
  return d.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true
  });
}

function formatDateTime(date: string | Date) {
  return `${formatDate(date)} at ${formatTime(date)}`;
}

// Email content viewer component
function EmailContent({ 
  block, 
  emailLog,
  isExpanded,
  onToggle
}: { 
  block: FlowBlock; 
  emailLog?: EmailLog;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const [copied, setCopied] = useState(false);
  
  const subject = emailLog?.subject || block.config?.subject || 'No subject';
  const body = emailLog?.body || block.config?.body || '';
  
  const handleCopy = async () => {
    await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-3">
      <button
        onClick={onToggle}
        className="flex items-center gap-2 text-sm text-violet-600 hover:text-violet-700 font-medium"
      >
        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        {isExpanded ? 'Hide email content' : 'View email content'}
      </button>
      
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Mail className="w-3.5 h-3.5" />
                  <span>Email Preview</span>
                </div>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 px-2 py-1 rounded-md hover:bg-slate-100 transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Subject</label>
                  <p className="text-sm text-slate-900 font-medium mt-0.5">{subject}</p>
                </div>
                
                {body && (
                  <div>
                    <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Body</label>
                    <div className="text-sm text-slate-700 mt-1 whitespace-pre-wrap bg-slate-50 rounded-lg p-3 max-h-48 overflow-y-auto">
                      {body}
                    </div>
                  </div>
                )}
                
                {emailLog?.sent_at && (
                  <div className="pt-2 border-t border-slate-100">
                    <span className="text-xs text-slate-400">
                      Sent {formatDateTime(emailLog.sent_at)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Wait timer with progress
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
  
  if (remaining <= 0) {
    return (
      <div className="mt-2 flex items-center gap-2 text-emerald-600">
        <Zap className="w-4 h-4" />
        <span className="text-sm font-medium">Ready to send next email</span>
      </div>
    );
  }
  
  return (
    <div className="mt-3 p-3 bg-amber-50 rounded-xl border border-amber-200">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-amber-800">Time until next step</span>
        <span className="text-lg font-bold text-amber-900">{formatDuration(remaining)}</span>
      </div>
      
      <div className="w-full bg-amber-200 rounded-full h-2 mb-3">
        <motion.div
          className="bg-amber-500 h-2 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
      
      <div className="flex items-center justify-between text-xs text-amber-700">
        <span>Started {formatDuration(elapsed > 0 ? elapsed : 0)} ago</span>
        <span>Sends at {formatTime(scheduledFor)}</span>
      </div>
      
        <button
          onClick={handleSkipWait}
          disabled={adjusting}
        className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors disabled:opacity-50"
      >
        <FastForward className="w-4 h-4" />
        Skip wait & send now
          </button>
    </div>
  );
}

export function CadenceExecutionViewer({
  blocks,
  execution,
  cadenceName = "Cadence",
  contactName,
  contactEmail,
  companyName,
  responded,
  onClose,
  onRefresh,
}: Props) {
  const [expandedBlocks, setExpandedBlocks] = useState<Set<string>>(new Set());
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  
  const executedBlockIds = execution?.metadata?.executedBlockIds || [];
  const currentBlockId = execution?.current_block_id;
  const isPaused = execution?.status === "paused";
  const isCompleted = execution?.status === "completed";
  const isError = execution?.status === "error";
  const pausedDueToReply = execution?.metadata?.paused_reason === "email_reply_received";
  
  // Fetch email logs for this execution
  useEffect(() => {
    async function fetchEmailLogs() {
      if (!execution?.company_cadence_id) {
        setLoadingLogs(false);
        return;
      }
      
      try {
        const { data, error } = await supabase
          .from('email_logs')
          .select('*')
          .eq('company_cadence_id', execution.company_cadence_id)
          .order('sent_at', { ascending: true });
        
        if (!error && data) {
          setEmailLogs(data);
        }
      } catch (err) {
        console.error('Error fetching email logs:', err);
      } finally {
        setLoadingLogs(false);
      }
    }
    
    fetchEmailLogs();
  }, [execution?.company_cadence_id]);

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
  const emailBlocks = orderedBlocks.filter(b => b.type === 'email');
  const sentEmails = executedBlockIds.filter(id => {
    const block = blocks.find(b => b.id === id);
    return block?.type === 'email';
  });

  const isCurrentlyWaiting = execution?.scheduled_for && new Date(execution.scheduled_for).getTime() > Date.now();
  
  const toggleBlock = (blockId: string) => {
    setExpandedBlocks(prev => {
      const next = new Set(prev);
      if (next.has(blockId)) {
        next.delete(blockId);
      } else {
        next.add(blockId);
      }
      return next;
    });
  };

  const getBlockStatus = (block: FlowBlock): "completed" | "current" | "waiting" | "skipped" | "pending" | "error" => {
    if (isError && block.id === currentBlockId) return "error";
    
    if (executedBlockIds.includes(block.id)) return "completed";
    
    if (block.id === currentBlockId) {
      if (block.type === "delay" && execution?.scheduled_for) return "waiting";
      return "current";
    }
    
    if (pausedDueToReply) return "skipped";
    return "pending";
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'completed':
        return { bg: 'bg-emerald-500', light: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' };
      case 'current':
        return { bg: 'bg-violet-500', light: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700' };
      case 'waiting':
        return { bg: 'bg-amber-500', light: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' };
      case 'error':
        return { bg: 'bg-red-500', light: 'bg-red-50', border: 'border-red-200', text: 'text-red-700' };
      case 'skipped':
        return { bg: 'bg-slate-300', light: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-400' };
      default:
        return { bg: 'bg-slate-300', light: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-500' };
    }
  };

  const getBlockIcon = (type: string) => {
    switch (type) {
      case 'trigger': return Play;
      case 'email': return Mail;
      case 'voicecall': return Phone;
      case 'delay': return Clock;
      case 'linkedinmessage': return MessageSquare;
      default: return Circle;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-xl font-semibold text-slate-900">{cadenceName}</h2>
            {responded && (
                  <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium flex items-center gap-1">
                    <Reply className="w-3 h-3" />
                    Replied
                  </span>
                )}
                {isCompleted && !responded && (
                  <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">
                    Completed
                  </span>
                )}
                {isError && (
                  <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Error
                  </span>
                )}
                {!isPaused && !isCompleted && !isError && execution?.status === "active" && (
                  <span className="px-2.5 py-1 bg-violet-100 text-violet-700 rounded-full text-xs font-medium">
                    {isCurrentlyWaiting ? 'Waiting' : 'Active'}
                  </span>
                )}
              </div>
              
              {/* Contact Info */}
              <div className="flex items-center gap-4 text-sm text-slate-500">
                {contactName && (
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" />
                    <span>{contactName}</span>
              </div>
            )}
                {contactEmail && (
                  <div className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5" />
                    <span className="text-slate-600">{contactEmail}</span>
              </div>
            )}
              </div>
            </div>
            
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-100">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-900">{sentEmails.length}/{emailBlocks.length}</p>
              <p className="text-xs text-slate-500">Emails Sent</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-900">
                {responded ? '1' : '0'}
              </p>
              <p className="text-xs text-slate-500">Responses</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-900">
                {execution?.created_at ? formatDate(execution.created_at) : '-'}
              </p>
              <p className="text-xs text-slate-500">Started</p>
            </div>
          </div>
        </div>

        {/* Response Alert */}
          {responded && (
          <div className="mx-6 mt-4 p-4 bg-emerald-50 rounded-xl border border-emerald-200">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <MessageCircle className="w-5 h-5 text-emerald-600" />
                </div>
              <div className="flex-1">
                <h3 className="font-semibold text-emerald-800">🎉 Great news! They replied!</h3>
                <p className="text-sm text-emerald-700 mt-1">
                  {contactName || 'This contact'} responded to your outreach. The sequence was automatically paused.
                </p>
                    {execution?.metadata?.paused_at && (
                  <p className="text-xs text-emerald-600 mt-2">
                    Response received {formatDateTime(execution.metadata.paused_at)}
                  </p>
                )}
              </div>
              </div>
            </div>
          )}

        {/* Timeline */}
        <div className="px-6 py-4 overflow-y-auto max-h-[calc(90vh-320px)]">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Sequence Timeline</h3>
          
          <div className="space-y-1">
            {orderedBlocks.map((block, index) => {
              const status = getBlockStatus(block);
              const config = getStatusConfig(status);
              const Icon = getBlockIcon(block.type);
              const isLast = index === orderedBlocks.length - 1;
              const isExpanded = expandedBlocks.has(block.id);
              const emailLog = block.type === 'email' 
                ? emailLogs.find(log => log.subject === block.config?.subject)
                : undefined;

              return (
                <div key={block.id} className="relative">
                  {/* Connector line */}
                  {!isLast && (
                    <div
                      className={`absolute left-5 top-12 w-0.5 h-6 ${
                        status === 'completed' ? 'bg-emerald-300' : 'bg-slate-200'
                      }`}
                    />
                  )}

                  <div
                    className={`relative p-4 rounded-xl transition-all ${config.light} border ${config.border}`}
                  >
                    <div className="flex items-start gap-4">
                      {/* Icon */}
                      <div
                        className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${config.bg}`}
                      >
                        {status === 'completed' ? (
                          <CheckCircle className="w-5 h-5 text-white" />
                        ) : status === 'waiting' ? (
                          <Loader2 className="w-5 h-5 text-white animate-spin" />
                        ) : status === 'error' ? (
                          <AlertCircle className="w-5 h-5 text-white" />
                        ) : (
                          <Icon className="w-5 h-5 text-white" />
                      )}
                    </div>

                      {/* Content */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className={`font-semibold ${status === 'skipped' ? 'text-slate-400' : 'text-slate-900'}`}>
                            {block.title || (block.type.charAt(0).toUpperCase() + block.type.slice(1))}
                        </h4>
                          
                          {status === 'completed' && (
                            <span className="text-xs text-emerald-600 font-medium">✓ Completed</span>
                          )}
                          {status === 'current' && !isCurrentlyWaiting && (
                            <span className="px-2 py-0.5 bg-violet-500 text-white text-xs rounded-full font-medium">
                            In Progress
                          </span>
                        )}
                          {status === 'waiting' && (
                            <span className="px-2 py-0.5 bg-amber-500 text-white text-xs rounded-full font-medium">
                            Waiting
                          </span>
                        )}
                          {status === 'skipped' && (
                            <span className="text-xs text-slate-400">Skipped</span>
                        )}
                      </div>

                        {/* Email block details */}
                        {block.type === 'email' && (
                          <div>
                            <p className={`text-sm ${status === 'skipped' ? 'text-slate-400' : 'text-slate-600'}`}>
                              Subject: <span className="font-medium">{block.config?.subject || 'No subject'}</span>
                            </p>
                            
                            {status === 'completed' && (
                              <EmailContent
                                block={block}
                                emailLog={emailLog}
                                isExpanded={isExpanded}
                                onToggle={() => toggleBlock(block.id)}
                              />
                            )}
                          </div>
                        )}

                        {/* Delay block details */}
                        {block.type === 'delay' && (
                        <div>
                            <p className={`text-sm ${status === 'skipped' ? 'text-slate-400' : 'text-slate-600'}`}>
                              Wait for:{' '}
                              <span className="font-medium">
                                {[
                                  block.config?.delayDays && `${block.config.delayDays}d`,
                                  block.config?.delayHours && `${block.config.delayHours}h`,
                                  block.config?.delayMinutes && `${block.config.delayMinutes}m`,
                                  block.config?.delaySeconds && `${block.config.delaySeconds}s`,
                                ].filter(Boolean).join(' ') || '0s'}
                              </span>
                            </p>
                            
                            {status === 'waiting' && (
                            <WaitTimer 
                              scheduledFor={execution?.scheduled_for} 
                              config={block.config}
                              executionId={execution?.id}
                              onRefresh={onRefresh}
                            />
                          )}
                        </div>
                      )}

                        {/* Trigger block */}
                        {block.type === 'trigger' && status === 'completed' && execution?.created_at && (
                          <p className="text-xs text-slate-400 mt-1">
                            Started {formatDateTime(execution.created_at)}
                          </p>
                        )}

                        {/* LinkedIn message */}
                        {block.type === 'linkedinmessage' && block.config?.linkedinMessage && (
                          <p className={`text-sm truncate ${status === 'skipped' ? 'text-slate-400' : 'text-slate-600'}`}>
                            Message: {block.config.linkedinMessage.substring(0, 100)}...
                        </p>
                      )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              {sentEmails.length} of {emailBlocks.length} emails sent
              {responded && ' • Conversation started! 🎯'}
            </p>
            <Button 
              onClick={onClose}
              className="bg-slate-900 hover:bg-slate-800 text-white"
            >
              Close
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
