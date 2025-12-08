"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Mail, Clock, CheckCircle, MessageCircle, Pause, Play, X as XIcon, RefreshCw, Plus, FastForward, Eye, MoreHorizontal, Timer, AlertCircle, RotateCcw, Zap } from "lucide-react";
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

  // Update time every second for live timers
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => { fetchOutreach(); }, []);

  // Stats
  const stats = {
    total: outreach.length,
    active: outreach.filter(o => o.status === 'active').length,
    paused: outreach.filter(o => o.status === 'paused' && !o.responded).length,
    completed: outreach.filter(o => o.status === 'completed' && !o.responded).length,
    responded: outreach.filter(o => o.responded).length,
  };

  // Filtered outreach
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
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
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
      
      // Always refresh the outreach list to show latest state
      await fetchOutreach();
      
      // Show a toast or message if something happened
      if (data.message && data.message !== 'Everything is up to date') {
        console.log('✅ Refresh complete:', data.message);
      }
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

  // Fetch fresh execution data before showing viewer
  const handleViewExecution = async (item: OutreachItem) => {
    if (!item.execution?.id) {
      setSelectedOutreach(item);
      return;
    }
    
    try {
      // Fetch fresh execution data
      const { data: freshExecution, error } = await supabase
        .from('cadence_executions')
        .select('*')
        .eq('id', item.execution.id)
        .single();
      
      if (error || !freshExecution) {
        console.error('Error fetching fresh execution:', error);
        setSelectedOutreach(item); // Fall back to stale data
        return;
      }
      
      // Update the item with fresh execution data
      const updatedItem = {
        ...item,
        execution: freshExecution as ExecutionData,
      };
      
      setSelectedOutreach(updatedItem);
    } catch (err) {
      console.error('Error in handleViewExecution:', err);
      setSelectedOutreach(item);
    }
  };

  const handleRetry = async (item: OutreachItem) => {
    if (!item.execution?.id) return;
    if (!confirm('Retry this cadence? Make sure you have fixed the email content in the cadence editor first.')) return;
    setActionLoading(item.id);
    try {
      // Reset the execution to active and let it retry
      const response = await fetch('/api/cadence/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyCadenceId: item.id })
      });
      if (!response.ok) throw new Error('Failed to retry');
      await fetchOutreach();
    } catch (error: any) {
      console.error('Error retrying:', error);
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
      // Timer is paused - calculate how much time was remaining when paused
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

  // Check if cadence is paused due to plan expiration
  const isPausedDueToPlan = (item: OutreachItem) => {
    return item.status === 'paused' && item.execution?.metadata?.paused_reason === 'plan_expired';
  };

  const getStatusStyles = (item: OutreachItem) => {
    if (item.responded) return { bg: 'bg-green-50', text: 'text-green-700', icon: <MessageCircle className="h-4 w-4" /> };
    if (item.status === 'error') return { bg: 'bg-red-50', text: 'text-red-700', icon: <AlertCircle className="h-4 w-4" /> };
    if (item.status === 'active') return { bg: 'bg-blue-50', text: 'text-blue-700', icon: <Clock className="h-4 w-4" /> };
    if (item.status === 'completed') return { bg: 'bg-gray-100', text: 'text-gray-600', icon: <CheckCircle className="h-4 w-4" /> };
    if (isPausedDueToPlan(item)) return { bg: 'bg-orange-50', text: 'text-orange-700', icon: <Zap className="h-4 w-4" /> };
    if (item.status === 'paused') return { bg: 'bg-yellow-50', text: 'text-yellow-700', icon: <Pause className="h-4 w-4" /> };
    return { bg: 'bg-gray-50', text: 'text-gray-600', icon: <Mail className="h-4 w-4" /> };
  };

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
    </div>
  );

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Outreach</h1>
          <p className="text-gray-500 text-sm mt-1">Track and manage your email sequences</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleCheckReplies} 
            disabled={checkingReplies}
            className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            title="Refresh everything: check replies, send scheduled emails, update all stats"
          >
            <RefreshCw className={`h-5 w-5 ${checkingReplies ? 'animate-spin' : ''}`} />
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded-lg bg-black text-white hover:bg-gray-800 flex items-center gap-2 transition-colors text-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            Add Person
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        {[
          { label: 'Total', value: stats.total, filter: 'all' as FilterType },
          { label: 'Active', value: stats.active, filter: 'active' as FilterType },
          { label: 'Paused', value: stats.paused, filter: 'paused' as FilterType },
          { label: 'Completed', value: stats.completed, filter: 'completed' as FilterType },
          { label: 'Responded', value: stats.responded, filter: 'responded' as FilterType },
        ].map((stat) => (
          <button
            key={stat.label}
            onClick={() => setFilter(stat.filter)}
            className={`p-4 rounded-xl border transition-all text-left ${
              filter === stat.filter 
                ? 'border-black bg-gray-50' 
                : 'border-gray-200 hover:border-gray-300 bg-white'
            }`}
          >
            <div className="text-2xl font-semibold text-gray-900">{stat.value}</div>
            <div className="text-sm text-gray-500">{stat.label}</div>
          </button>
        ))}
      </div>

      {/* List */}
      {filteredOutreach.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <Mail className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <h3 className="text-gray-900 font-medium mb-1">
            {filter === 'all' ? 'No outreach yet' : `No ${filter} outreach`}
          </h3>
          <p className="text-gray-500 text-sm mb-4">
            {filter === 'all' ? 'Add someone to a cadence to get started' : 'Check back later'}
          </p>
          {filter === 'all' && (
            <button 
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 rounded-lg bg-black text-white hover:bg-gray-800 text-sm font-medium inline-flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Person
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {filteredOutreach.map((item, idx) => {
            const styles = getStatusStyles(item);
            const waiting = isCurrentlyWaiting(item);
            const waitInfo = getWaitInfo(item);
            
            return (
              <div 
                key={item.id} 
                className={`px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors ${
                  idx !== filteredOutreach.length - 1 ? 'border-b border-gray-100' : ''
                }`}
              >
                {/* Left: Contact Info */}
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${styles.bg} ${styles.text}`}>
                    {item.contact?.first_name?.charAt(0) || '?'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 truncate">
                        {item.contact ? `${item.contact.first_name} ${item.contact.last_name}` : 'Unknown'}
                      </span>
                      {item.responded && (
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium flex-shrink-0">
                          Replied
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 truncate">
                      {item.company?.name || 'Unknown Company'} • {item.cadence?.name || 'Unknown Cadence'}
                    </div>
                  </div>
                </div>

                {/* Center: Progress & Wait Timer */}
                <div className="flex items-center gap-6 px-4">
                  <div className="text-center">
                    <div className="text-sm font-medium text-gray-900">
                      {item.current_step}/{item.total_steps}
                    </div>
                    <div className="text-xs text-gray-500">Emails</div>
                  </div>
                  
                  {/* Wait Timer */}
                  {waiting && waitInfo && (
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${waitInfo.isPaused ? 'bg-yellow-50' : 'bg-blue-50'}`}>
                      <Timer className={`h-4 w-4 ${waitInfo.isPaused ? 'text-yellow-600' : 'text-blue-600'}`} />
                      <div className="text-xs">
                        {waitInfo.isPaused ? (
                          <span className="text-yellow-700 font-medium">
                            Paused • {formatDuration(waitInfo.remainingMs)} left
                          </span>
                        ) : (
                          <span className="text-blue-700">
                            <span className="font-medium">{formatDuration(waitInfo.remainingMs)}</span>
                            <span className="text-blue-500 ml-1">remaining</span>
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {!waiting && (
                    <div className="w-24">
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all ${
                            item.responded ? 'bg-green-500' : 
                            item.status === 'completed' ? 'bg-gray-400' : 
                            item.status === 'paused' ? 'bg-yellow-500' : 'bg-blue-500'
                          }`}
                          style={{ width: `${item.total_steps > 0 ? (item.current_step / item.total_steps) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Right: Status & Actions */}
                <div className="flex items-center gap-3">
                  <div 
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 ${styles.bg} ${styles.text}`}
                    title={item.status === 'error' && item.execution?.metadata?.error ? item.execution.metadata.error : isPausedDueToPlan(item) ? 'Paused due to subscription ending. Upgrade to resume.' : ''}
                  >
                    {styles.icon}
                    <span>
                      {item.responded ? 'Responded' : 
                       item.status === 'error' ? 'Error' :
                       item.status === 'active' ? 'Active' :
                       item.status === 'completed' ? 'Done' :
                       isPausedDueToPlan(item) ? 'Upgrade to Resume' :
                       item.status === 'paused' ? 'Paused' : item.status}
                    </span>
                  </div>
                  
                  {/* Action buttons */}
                  <div className="flex items-center gap-1">
                    {waiting && item.status === 'active' && (
                      <button 
                        onClick={() => handleSkipWait(item)} 
                        disabled={skipWaitLoading === item.id}
                        className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Send now"
                      >
                        <FastForward className="h-4 w-4" />
                      </button>
                    )}
                    
                    <button 
                      onClick={() => handleViewExecution(item)} 
                      className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                      title="View details"
                    >
                      <Eye className="h-4 w-4" />
                    </button>

                    {/* Retry button for errors */}
                    {item.status === 'error' && (
                      <button 
                        onClick={() => handleRetry(item)} 
                        disabled={actionLoading === item.id}
                        className="p-2 text-gray-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                        title={`Retry - ${item.execution?.metadata?.error || 'Unknown error'}`}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </button>
                    )}

                    {/* More actions dropdown */}
                    {(item.status === 'active' || item.status === 'paused') && !item.responded && (
                      <div className="relative">
                        <button 
                          onClick={() => setExpandedActions(expandedActions === item.id ? null : item.id)}
                          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                        
                        {expandedActions === item.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setExpandedActions(null)} />
                            <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                              {item.status === 'active' && (
                                <>
                                  <button
                                    onClick={() => handlePauseCadence(item)}
                                    disabled={actionLoading === item.id}
                                    className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                  >
                                    <Pause className="h-4 w-4" />
                                    Pause
                                  </button>
                                  <button
                                    onClick={() => handleCancelCadence(item)}
                                    disabled={actionLoading === item.id}
                                    className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                  >
                                    <XIcon className="h-4 w-4" />
                                    Cancel
                                  </button>
                                </>
                              )}
                              {item.status === 'paused' && (
                                isPausedDueToPlan(item) ? (
                                  <button
                                    onClick={() => router.push('/upgrade')}
                                    className="w-full px-3 py-2 text-left text-sm text-indigo-600 hover:bg-indigo-50 flex items-center gap-2"
                                  >
                                    <Zap className="h-4 w-4" />
                                    Upgrade to Resume
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleResumeCadence(item)}
                                    disabled={actionLoading === item.id}
                                    className="w-full px-3 py-2 text-left text-sm text-green-600 hover:bg-green-50 flex items-center gap-2"
                                  >
                                    <Play className="h-4 w-4" />
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
            );
          })}
        </div>
      )}

      {/* Execution Viewer Modal */}
      <AnimatePresence>
        {selectedOutreach && (
          <CadenceExecutionViewer
            blocks={selectedOutreach.execution?.metadata?.blocks || selectedOutreach.cadence?.nodes || []}
            execution={selectedOutreach.execution || null}
            cadenceName={selectedOutreach.cadence?.name || 'Unknown Cadence'}
            contactName={selectedOutreach.contact ? selectedOutreach.contact.first_name + ' ' + selectedOutreach.contact.last_name : undefined}
            contactEmail={selectedOutreach.contact?.email}
            responded={selectedOutreach.responded}
            onClose={() => setSelectedOutreach(null)}
            onRefresh={() => { fetchOutreach(); setSelectedOutreach(null); }}
          />
        )}
      </AnimatePresence>

      {/* Add to Cadence Modal */}
      <AddToCadenceModal 
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => fetchOutreach()}
      />
    </div>
  );
}
