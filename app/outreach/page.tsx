"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { 
  Mail, 
  Clock, 
  CheckCircle, 
  MessageCircle, 
  Pause, 
  Play, 
  X as XIcon, 
  RefreshCw, 
  Plus, 
  FastForward, 
  Eye, 
  MoreHorizontal, 
  Timer, 
  AlertCircle, 
  RotateCcw, 
  Zap,
  Send,
  ArrowUpRight,
  Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { CadenceExecutionViewer } from "@/components/cadence-execution-viewer";
import { AddToCadenceModal } from "@/components/add-to-cadence-modal";

export const dynamic = 'force-dynamic';

interface ExecutionData {
  id: string;
  company_cadence_id: string;
  current_block_id: string;
  status: 'active' | 'paused' | 'completed' | 'error';
  scheduled_for?: string;
  metadata?: {
    executedBlockIds?: string[];
    paused_reason?: string;
    paused_at?: string;
    blocks?: any[];
    user_id?: string;
    error?: string;
  };
  created_at: string;
  updated_at: string;
}

interface OutreachItem {
  id: string;
  company_id: string;
  contact_id: string | null;
  cadence_id: string;
  status: string;
  current_step: number;
  total_steps: number;
  last_action: string;
  last_action_date: string;
  responded: boolean;
  company: { id: string; name: string; } | null;
  contact: { id: string; first_name: string; last_name: string; email: string; } | null;
  cadence: { id: string; name: string; nodes: any[]; } | null;
  execution?: ExecutionData;
  waitInfo?: {
    totalMs: number;
    elapsedMs: number;
    remainingMs: number;
    isPaused: boolean;
    pausedAt?: string;
  };
}

type FilterType = 'all' | 'active' | 'completed' | 'responded' | 'paused';

export default function OutreachPage() {
  const router = useRouter();
  const [outreach, setOutreach] = useState<OutreachItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedOutreach, setSelectedOutreach] = useState<OutreachItem | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [checkingReplies, setCheckingReplies] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [skipWaitLoading, setSkipWaitLoading] = useState<string | null>(null);
  const [expandedActions, setExpandedActions] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => { fetchOutreach(); }, []);

  const stats = {
    total: outreach.length,
    active: outreach.filter(o => o.status === 'active').length,
    paused: outreach.filter(o => o.status === 'paused' && !o.responded).length,
    completed: outreach.filter(o => o.status === 'completed' && !o.responded).length,
    responded: outreach.filter(o => o.responded).length,
  };

  const filteredOutreach = outreach.filter(item => {
    if (filter === 'all') return true;
    if (filter === 'active') return item.status === 'active';
    if (filter === 'paused') return item.status === 'paused' && !item.responded;
    if (filter === 'completed') return item.status === 'completed' && !item.responded;
    if (filter === 'responded') return item.responded;
    return true;
  });

  const formatDuration = (ms: number) => {
    if (ms <= 0) return '0s';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m`;
    return `${seconds}s`;
  };

  const handlePauseCadence = async (item: OutreachItem) => {
    if (!confirm(`Pause cadence for ${item.contact?.first_name || 'this contact'}?`)) return;
    setActionLoading(item.id);
    try {
      const response = await fetch('/api/cadence/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyCadenceId: item.id })
      });
      if (!response.ok) throw new Error('Failed to pause cadence');
      await fetchOutreach();
    } catch (error) {
      console.error('Error pausing cadence:', error);
      alert('Failed to pause cadence');
    } finally {
      setActionLoading(null);
      setExpandedActions(null);
    }
  };

  const handleCancelCadence = async (item: OutreachItem) => {
    if (!confirm(`Cancel cadence for ${item.contact?.first_name || 'this contact'}? This will stop all future emails.`)) return;
    setActionLoading(item.id);
    try {
      const response = await fetch('/api/cadence/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyCadenceId: item.id })
      });
      if (!response.ok) throw new Error('Failed to cancel cadence');
      await fetchOutreach();
    } catch (error) {
      console.error('Error cancelling cadence:', error);
      alert('Failed to cancel cadence');
    } finally {
      setActionLoading(null);
      setExpandedActions(null);
    }
  };

  const handleResumeCadence = async (item: OutreachItem) => {
    if (!confirm('Resume cadence for ' + (item.contact?.first_name || 'this contact') + '?')) return;
    setActionLoading(item.id);
    try {
      const response = await fetch('/api/cadence/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyCadenceId: item.id })
      });
      if (!response.ok) throw new Error('Failed to resume cadence');
      await fetchOutreach();
    } catch (error) {
      console.error('Error resuming cadence:', error);
      alert('Failed to resume cadence');
    } finally {
      setActionLoading(null);
      setExpandedActions(null);
    }
  };

  const handleCheckReplies = async () => {
    setCheckingReplies(true);
    try {
      const response = await fetch('/api/cadence/refresh-all', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to refresh');
      await fetchOutreach();
    } catch (error: any) {
      console.error('Error refreshing:', error);
      alert('Error refreshing: ' + error.message);
    } finally {
      setCheckingReplies(false);
    }
  };

  const handleSkipWait = async (item: OutreachItem) => {
    if (!item.execution?.id) return;
    if (!confirm('Skip wait and send the next email immediately?')) return;
    setSkipWaitLoading(item.id);
    try {
      const response = await fetch('/api/cadence/skip-wait', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ executionId: item.execution.id })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to skip wait');
      await fetchOutreach();
    } catch (error: any) {
      console.error('Error skipping wait:', error);
      alert('Error: ' + error.message);
    } finally {
      setSkipWaitLoading(null);
      setExpandedActions(null);
    }
  };

  const handleViewExecution = async (item: OutreachItem) => {
    if (!item.execution?.id) {
      setSelectedOutreach(item);
      return;
    }
    
    try {
      const { data: freshExecution, error } = await supabase
        .from('cadence_executions')
        .select('*')
        .eq('id', item.execution.id)
        .single();
      
      if (error || !freshExecution) {
        setSelectedOutreach(item);
        return;
      }
      
      setSelectedOutreach({
        ...item,
        execution: freshExecution as ExecutionData,
      });
    } catch (err) {
      setSelectedOutreach(item);
    }
  };

  const handleRetry = async (item: OutreachItem) => {
    if (!item.execution?.id) return;
    if (!confirm('Retry this cadence?')) return;
    setActionLoading(item.id);
    try {
      const response = await fetch('/api/cadence/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyCadenceId: item.id })
      });
      if (!response.ok) throw new Error('Failed to retry');
      await fetchOutreach();
    } catch (error: any) {
      alert('Error: ' + error.message);
    } finally {
      setActionLoading(null);
    }
  };

  const isCurrentlyWaiting = (item: OutreachItem) => {
    if (!item.execution?.current_block_id) return false;
    const blocks = item.execution?.metadata?.blocks || item.cadence?.nodes || [];
    const currentBlock = blocks.find((b: any) => b.id === item.execution?.current_block_id);
    return currentBlock?.type === 'delay';
  };

  const getWaitInfo = (item: OutreachItem) => {
    if (!item.execution?.current_block_id) return null;
    const blocks = item.execution?.metadata?.blocks || item.cadence?.nodes || [];
    const currentBlock = blocks.find((b: any) => b.id === item.execution?.current_block_id);
    
    if (currentBlock?.type !== 'delay') return null;

    const config = currentBlock.config || {};
    const totalMs = 
      (config.delayDays || 0) * 24 * 60 * 60 * 1000 +
      (config.delayHours || 0) * 60 * 60 * 1000 +
      (config.delayMinutes || 0) * 60 * 1000 +
      (config.delaySeconds || 0) * 1000;

    const scheduledFor = item.execution?.scheduled_for ? new Date(item.execution.scheduled_for).getTime() : null;
    const isPaused = item.status === 'paused';
    const pausedAt = item.execution?.metadata?.paused_at;

    if (isPaused && pausedAt) {
      const pausedTime = new Date(pausedAt).getTime();
      const remainingMs = scheduledFor ? Math.max(0, scheduledFor - pausedTime) : 0;
      const elapsedMs = totalMs - remainingMs;
      return { totalMs, elapsedMs, remainingMs, isPaused: true, pausedAt };
    }

    if (scheduledFor) {
      const remainingMs = Math.max(0, scheduledFor - now);
      const elapsedMs = totalMs - remainingMs;
      return { totalMs, elapsedMs, remainingMs, isPaused: false };
    }

    return { totalMs, elapsedMs: 0, remainingMs: totalMs, isPaused: false };
  };

  const fetchOutreach = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('company_cadences')
        .select('id, company_id, contact_id, cadence_id, status, company:companies(id, name), contact:contacts(id, first_name, last_name, email), cadence:cadences(id, name, nodes)')
        .order('created_at', { ascending: false });
      if (error) throw error;

      const companyCadenceIds = data?.map(cc => cc.id) || [];
      const { data: executions } = await supabase.from('cadence_executions').select('*').in('company_cadence_id', companyCadenceIds);
      const executionsMap = new Map();
      executions?.forEach(exec => executionsMap.set(exec.company_cadence_id, exec));

      const transformedData: OutreachItem[] = (data || []).map((item: any) => {
        const execution = executionsMap.get(item.id);
        const cadenceBlocks = execution?.metadata?.blocks || item.cadence?.nodes || [];
        const emailBlocks = cadenceBlocks.filter((b: any) => b.type === 'email');
        const executedBlockIds = execution?.metadata?.executedBlockIds || [];
        
        const executedEmailBlocks = executedBlockIds.filter((id: string) => {
          const block = cadenceBlocks.find((b: any) => b.id === id);
          return block?.type === 'email';
        });
        const currentStep = executedEmailBlocks.length;
        const totalSteps = emailBlocks.length;
        const responded = execution?.metadata?.paused_reason === 'email_reply_received';

        let lastAction = 'Not started';
        let lastActionDate = item.created_at;
        if (responded) {
          lastAction = 'Responded';
          lastActionDate = execution?.metadata?.paused_at || execution?.updated_at || item.created_at;
        } else if (currentStep > 0) {
          const lastBlockId = executedBlockIds[executedBlockIds.length - 1];
          const lastBlock = cadenceBlocks.find((b: any) => b.id === lastBlockId);
          if (lastBlock) {
            if (lastBlock.type === 'email') lastAction = lastBlock.title || 'Email sent';
            else if (lastBlock.type === 'delay') lastAction = 'Waiting';
          }
          lastActionDate = execution?.updated_at || item.created_at;
        }

        return {
          id: item.id,
          company_id: item.company_id,
          contact_id: item.contact_id,
          cadence_id: item.cadence_id,
          status: execution?.status || 'pending',
          current_step: currentStep,
          total_steps: totalSteps,
          last_action: lastAction,
          last_action_date: lastActionDate,
          responded: responded,
          company: Array.isArray(item.company) ? item.company[0] : item.company,
          contact: Array.isArray(item.contact) ? item.contact[0] : item.contact,
          cadence: Array.isArray(item.cadence) ? item.cadence[0] : item.cadence,
          execution: execution,
        };
      });
      setOutreach(transformedData);
    } catch (error) {
      console.error('Error fetching outreach:', error);
    } finally {
      setLoading(false);
    }
  };

  const isPausedDueToPlan = (item: OutreachItem) => {
    return item.status === 'paused' && item.execution?.metadata?.paused_reason === 'plan_expired';
  };

  const getStatusConfig = (item: OutreachItem) => {
    if (item.responded) return { 
      bg: 'bg-emerald-50', 
      text: 'text-emerald-700', 
      border: 'border-emerald-200',
      icon: <MessageCircle className="w-3.5 h-3.5" />,
      label: 'Replied'
    };
    if (item.status === 'error') return { 
      bg: 'bg-red-50', 
      text: 'text-red-600', 
      border: 'border-red-200',
      icon: <AlertCircle className="w-3.5 h-3.5" />,
      label: 'Error'
    };
    if (item.status === 'active') return { 
      bg: 'bg-sky-50', 
      text: 'text-sky-700', 
      border: 'border-sky-200',
      icon: <Send className="w-3.5 h-3.5" />,
      label: 'Active'
    };
    if (item.status === 'completed') return { 
      bg: 'bg-slate-100', 
      text: 'text-slate-600', 
      border: 'border-slate-200',
      icon: <CheckCircle className="w-3.5 h-3.5" />,
      label: 'Done'
    };
    if (isPausedDueToPlan(item)) return { 
      bg: 'bg-amber-50', 
      text: 'text-amber-700', 
      border: 'border-amber-200',
      icon: <Zap className="w-3.5 h-3.5" />,
      label: 'Upgrade'
    };
    if (item.status === 'paused') return { 
      bg: 'bg-amber-50', 
      text: 'text-amber-700', 
      border: 'border-amber-200',
      icon: <Pause className="w-3.5 h-3.5" />,
      label: 'Paused'
    };
    return { 
      bg: 'bg-slate-50', 
      text: 'text-slate-600', 
      border: 'border-slate-200',
      icon: <Mail className="w-3.5 h-3.5" />,
      label: 'Pending'
    };
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-violet-500',
      'bg-sky-500',
      'bg-emerald-500',
      'bg-amber-500',
      'bg-rose-500',
      'bg-indigo-500',
    ];
    const index = (name?.charCodeAt(0) || 0) % colors.length;
    return colors[index];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-50 to-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-violet-200 border-t-violet-600 animate-spin" />
          <p className="text-slate-500 text-sm">Loading outreach...</p>
        </div>
    </div>
  );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50/30">
      <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start justify-between mb-8"
        >
        <div>
            <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Outreach</h1>
            <p className="text-slate-500 text-sm mt-1">Track and manage your email sequences</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleCheckReplies} 
            disabled={checkingReplies}
              className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-300 transition-all shadow-soft"
              title="Refresh"
          >
              <RefreshCw className={`w-4 h-4 ${checkingReplies ? 'animate-spin' : ''}`} />
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
              className="px-4 py-2.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 flex items-center gap-2 transition-all text-sm font-medium shadow-soft"
          >
              <Plus className="w-4 h-4" />
            Add Person
          </button>
        </div>
        </motion.div>

        {/* Stats Pills */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-wrap gap-2 mb-6"
        >
          {[
            { label: 'All', value: stats.total, filter: 'all' as FilterType, color: 'slate' },
            { label: 'Active', value: stats.active, filter: 'active' as FilterType, color: 'sky' },
            { label: 'Paused', value: stats.paused, filter: 'paused' as FilterType, color: 'amber' },
            { label: 'Completed', value: stats.completed, filter: 'completed' as FilterType, color: 'slate' },
            { label: 'Replied', value: stats.responded, filter: 'responded' as FilterType, color: 'emerald' },
        ].map((stat) => (
          <button
            key={stat.label}
            onClick={() => setFilter(stat.filter)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              filter === stat.filter 
                  ? 'bg-slate-900 text-white shadow-soft' 
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              {stat.label}
              <span className={`ml-2 ${filter === stat.filter ? 'text-slate-300' : 'text-slate-400'}`}>
                {stat.value}
              </span>
          </button>
        ))}
        </motion.div>

        {/* Outreach List */}
      {filteredOutreach.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16 bg-white rounded-2xl border border-slate-100 shadow-soft"
          >
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <Mail className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-2">
            {filter === 'all' ? 'No outreach yet' : `No ${filter} outreach`}
          </h3>
            <p className="text-slate-500 text-sm mb-6 max-w-sm mx-auto">
              {filter === 'all' ? 'Add someone to a cadence to start your outreach' : 'Check back later'}
          </p>
          {filter === 'all' && (
            <button 
              onClick={() => setShowAddModal(true)}
                className="px-5 py-2.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-sm font-medium inline-flex items-center gap-2"
            >
                <Plus className="w-4 h-4" />
              Add Person
            </button>
          )}
          </motion.div>
      ) : (
          <div className="space-y-3">
          {filteredOutreach.map((item, idx) => {
              const statusConfig = getStatusConfig(item);
            const waiting = isCurrentlyWaiting(item);
            const waitInfo = getWaitInfo(item);
              const progress = item.total_steps > 0 ? (item.current_step / item.total_steps) * 100 : 0;
            
            return (
                <motion.div
                key={item.id} 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className="bg-white rounded-2xl border border-slate-100 shadow-soft hover:shadow-soft-lg hover:border-slate-200 transition-all overflow-hidden"
                >
                  <div className="p-5">
                    <div className="flex items-center gap-4">
                      {/* Avatar */}
                      <div className={`w-11 h-11 rounded-full ${getAvatarColor(item.contact?.first_name || '')} flex items-center justify-center text-white font-medium text-sm flex-shrink-0`}>
                    {item.contact?.first_name?.charAt(0) || '?'}
                  </div>
                      
                      {/* Contact Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-semibold text-slate-900 truncate">
                        {item.contact ? `${item.contact.first_name} ${item.contact.last_name}` : 'Unknown'}
                      </span>
                      {item.responded && (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full font-medium flex-shrink-0">
                              Replied ✓
                        </span>
                      )}
                    </div>
                        <p className="text-sm text-slate-500 truncate">
                          {item.company?.name || 'Unknown Company'}
                          <span className="mx-1.5 text-slate-300">•</span>
                          {item.cadence?.name || 'Unknown Cadence'}
                        </p>
                      </div>

                      {/* Progress */}
                      <div className="hidden sm:flex items-center gap-4 px-4">
                        <div className="text-center">
                          <p className="text-lg font-semibold text-slate-900">
                            {item.current_step}/{item.total_steps}
                          </p>
                          <p className="text-xs text-slate-400">Emails</p>
                        </div>
                        
                        {/* Progress Bar */}
                        <div className="w-24">
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${progress}%` }}
                              transition={{ duration: 0.5, ease: "easeOut" }}
                              className={`h-full rounded-full ${
                                item.responded ? 'bg-emerald-500' : 
                                item.status === 'completed' ? 'bg-slate-400' : 
                                item.status === 'paused' ? 'bg-amber-500' : 'bg-violet-500'
                              }`}
                            />
                    </div>
                  </div>
                  </div>
                  
                  {/* Wait Timer */}
                  {waiting && waitInfo && (
                        <div className={`hidden md:flex items-center gap-2 px-3 py-2 rounded-xl ${waitInfo.isPaused ? 'bg-amber-50' : 'bg-sky-50'}`}>
                          <Timer className={`w-4 h-4 ${waitInfo.isPaused ? 'text-amber-500' : 'text-sky-500'}`} />
                          <span className={`text-sm font-medium ${waitInfo.isPaused ? 'text-amber-700' : 'text-sky-700'}`}>
                            {formatDuration(waitInfo.remainingMs)}
                          </span>
                    </div>
                  )}
                  
                      {/* Status Badge */}
                      <div className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 ${statusConfig.bg} ${statusConfig.text} border ${statusConfig.border}`}>
                        {statusConfig.icon}
                        <span>{statusConfig.label}</span>
                </div>

                      {/* Actions */}
                  <div className="flex items-center gap-1">
                    {waiting && item.status === 'active' && (
                      <button 
                        onClick={() => handleSkipWait(item)} 
                        disabled={skipWaitLoading === item.id}
                            className="p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                        title="Send now"
                      >
                            <FastForward className="w-4 h-4" />
                      </button>
                    )}
                    
                    <button 
                      onClick={() => handleViewExecution(item)} 
                          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                      title="View details"
                    >
                          <Eye className="w-4 h-4" />
                    </button>

                    {item.status === 'error' && (
                      <button 
                        onClick={() => handleRetry(item)} 
                        disabled={actionLoading === item.id}
                            className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                            title="Retry"
                      >
                            <RotateCcw className="w-4 h-4" />
                      </button>
                    )}

                    {(item.status === 'active' || item.status === 'paused') && !item.responded && (
                      <div className="relative">
                        <button 
                          onClick={() => setExpandedActions(expandedActions === item.id ? null : item.id)}
                              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                              <MoreHorizontal className="w-4 h-4" />
                        </button>
                        
                        {expandedActions === item.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setExpandedActions(null)} />
                                <div className="absolute right-0 top-full mt-2 w-44 bg-white rounded-xl shadow-lg border border-slate-200 py-2 z-20">
                              {item.status === 'active' && (
                                <>
                                  <button
                                    onClick={() => handlePauseCadence(item)}
                                    disabled={actionLoading === item.id}
                                        className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                  >
                                        <Pause className="w-4 h-4" />
                                    Pause
                                  </button>
                                  <button
                                    onClick={() => handleCancelCadence(item)}
                                    disabled={actionLoading === item.id}
                                        className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                  >
                                        <XIcon className="w-4 h-4" />
                                    Cancel
                                  </button>
                                </>
                              )}
                              {item.status === 'paused' && (
                                isPausedDueToPlan(item) ? (
                                  <button
                                    onClick={() => router.push('/upgrade')}
                                        className="w-full px-4 py-2 text-left text-sm text-violet-600 hover:bg-violet-50 flex items-center gap-2"
                                  >
                                        <Zap className="w-4 h-4" />
                                    Upgrade to Resume
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleResumeCadence(item)}
                                    disabled={actionLoading === item.id}
                                        className="w-full px-4 py-2 text-left text-sm text-emerald-600 hover:bg-emerald-50 flex items-center gap-2"
                                  >
                                        <Play className="w-4 h-4" />
                                    Resume
                                  </button>
                                )
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
                </motion.div>
            );
          })}
        </div>
      )}

        {/* Modals */}
      <AnimatePresence>
        {selectedOutreach && (
          <CadenceExecutionViewer
            blocks={selectedOutreach.execution?.metadata?.blocks || selectedOutreach.cadence?.nodes || []}
            execution={selectedOutreach.execution || null}
            cadenceName={selectedOutreach.cadence?.name || 'Unknown Cadence'}
            contactName={selectedOutreach.contact ? selectedOutreach.contact.first_name + ' ' + selectedOutreach.contact.last_name : undefined}
            contactEmail={selectedOutreach.contact?.email}
            companyName={selectedOutreach.company?.name}
            responded={selectedOutreach.responded}
            onClose={() => setSelectedOutreach(null)}
            onRefresh={() => { fetchOutreach(); setSelectedOutreach(null); }}
          />
        )}
      </AnimatePresence>

      <AddToCadenceModal 
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => fetchOutreach()}
      />
      </div>
    </div>
  );
}
