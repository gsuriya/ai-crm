"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Mail, Clock, CheckCircle, AlertCircle, Play, Pause, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export const dynamic = 'force-dynamic';

interface CadenceExecution {
  id: string;
  company_cadence_id: string;
  current_block_id: string;
  status: 'active' | 'paused' | 'completed' | 'error';
  scheduled_for?: string;
  metadata?: {
    company_id: string;
    cadence_id: string;
    blocks?: any[];
    executedBlockIds?: string[];
  };
  created_at: string;
  updated_at: string;
}

interface CompanyCadence {
  id: string;
  company_id: string;
  cadence_id: string;
  status: string;
  company?: {
    name: string;
  };
  cadence?: {
    name: string;
  };
}

interface Contact {
  email: string;
  first_name?: string;
  last_name?: string;
}

export default function OutreachPage() {
  const searchParams = useSearchParams();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [executions, setExecutions] = useState<(CadenceExecution & { companyCadence: CompanyCadence; contact?: Contact; currentBlock?: any })[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchOutreach = useCallback(async (showLoading = false) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get all executions (active, paused, and completed - don't auto-delete completed ones)
      const { data: executionsData, error: execError } = await supabase
        .from('cadence_executions')
        .select('*')
        .in('status', ['active', 'paused', 'completed'])
        .order('created_at', { ascending: false });

      if (execError) throw execError;

      // Get company_cadence associations
      const companyCadenceIds = executionsData?.map(e => e.company_cadence_id) || [];
      const { data: companyCadences, error: ccError } = await supabase
        .from('company_cadences')
        .select(`
          *,
          company:companies(name),
          cadence:cadences(name)
        `)
        .in('id', companyCadenceIds);

      if (ccError) throw ccError;

      // Get contacts for companies
      const companyIds = companyCadences?.map(cc => cc.company_id) || [];
      const { data: contacts, error: contactsError } = await supabase
        .from('contacts')
        .select('company_id, email, first_name, last_name')
        .in('company_id', companyIds);

      if (contactsError) throw contactsError;

      // Map contacts by company_id
      const contactsMap = new Map<string, Contact>();
      contacts?.forEach(contact => {
        if (!contactsMap.has(contact.company_id)) {
          contactsMap.set(contact.company_id, contact);
        }
      });

      // Combine executions with company/cadence info and contacts
      const enrichedExecutions = executionsData?.map(execution => {
        const companyCadence = companyCadences?.find(cc => cc.id === execution.company_cadence_id);
        const contact = companyCadence ? contactsMap.get(companyCadence.company_id) : undefined;
        
        // Get current block info
        const blocks = execution.metadata?.blocks || [];
        const currentBlock = blocks.find((b: any) => b.id === execution.current_block_id);

        return {
          ...execution,
          companyCadence: companyCadence || {} as CompanyCadence,
          contact,
          currentBlock,
        };
      }) || [];

      // Filter out Test Company executions (they shouldn't appear)
      // Only filter by company name, not cadence name (cadences like "tester2" are valid)
      const filteredExecutions = enrichedExecutions.filter(execution => {
        const companyName = execution.companyCadence?.company?.name || '';
        // Only filter out if company name contains "test" (case insensitive)
        return !companyName.toLowerCase().includes('test');
      });

      setExecutions(filteredExecutions);
    } catch (error) {
      console.error("Error fetching outreach:", error);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const isRefresh = searchParams?.get('refresh') === 'true';
    
    // Always fetch immediately on mount or when searchParams change (show loading only on initial load)
    fetchOutreach(true);
    
    // Clean up URL if refresh flag is present
    if (isRefresh) {
      window.history.replaceState({}, '', '/outreach');
    }
    
    // Background processor for scheduled executions (runs every 10 seconds)
    // This also checks for email replies and pauses cadences
    const processScheduledExecutions = async () => {
      try {
        const response = await fetch('/api/cadence/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        const data = await response.json();
        if (data.processed > 0) {
          console.log(`[Outreach Page] ✅ Processed ${data.processed} scheduled execution(s)`);
        }
        // Refresh the outreach list after processing (even if nothing was processed, 
        // to catch any paused cadences from reply detection)
        fetchOutreach(false);
      } catch (error) {
        // Silently fail - don't spam console
      }
    };

    // Process immediately on page load (checks for replies and processes scheduled executions)
    processScheduledExecutions();
    
    // Set up background processor interval (every 10 seconds)
    const processInterval = setInterval(() => {
      processScheduledExecutions();
    }, 10000);
    
    // If coming from starting a cadence, poll aggressively
    if (isRefresh) {
      // Poll every 2 seconds for first 10 seconds (less aggressive to reduce flashing)
      intervalRef.current = setInterval(() => fetchOutreach(false), 2000);
      const quickTimeout = setTimeout(() => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        // Then switch to normal 10 second interval
        intervalRef.current = setInterval(() => fetchOutreach(false), 10000);
      }, 10000);
      
      return () => {
        clearTimeout(quickTimeout);
        clearInterval(processInterval);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    } else {
      // Refresh every 10 seconds (don't show loading on refresh)
      intervalRef.current = setInterval(() => fetchOutreach(false), 10000);
      return () => {
        clearInterval(processInterval);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [searchParams, fetchOutreach]);

  const deleteExecution = async (executionId: string) => {
    if (!confirm('Are you sure you want to delete this execution? This cannot be undone.')) {
      return;
    }

    try {
      setDeletingId(executionId);
      const { error } = await supabase
        .from('cadence_executions')
        .delete()
        .eq('id', executionId);

      if (error) throw error;

      // Refresh the list
      await fetchOutreach();
    } catch (error) {
      console.error('Error deleting execution:', error);
      alert('Error deleting execution. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  const getStatusBadge = (execution: CadenceExecution) => {
    if (execution.status === 'completed') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-emerald-500 text-white shadow-sm">
          <CheckCircle className="h-3 w-3" />
          Complete
        </span>
      );
    }
    
    if (execution.status === 'error') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-red-500 text-white shadow-sm">
          <AlertCircle className="h-3 w-3" />
          Error
        </span>
      );
    }

    if (execution.status === 'paused') {
      const pausedReason = execution.metadata?.paused_reason;
      const pausedText = pausedReason === 'email_reply_received' 
        ? 'Paused (Reply received)' 
        : 'Paused';
      
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-amber-500 text-white shadow-sm">
          <Pause className="h-3 w-3" />
          {pausedText}
        </span>
      );
    }

    if (execution.scheduled_for) {
      const scheduledDate = new Date(execution.scheduled_for);
      const now = new Date();
      if (scheduledDate > now) {
        const diffMs = scheduledDate.getTime() - now.getTime();
        const diffMinutes = Math.ceil(diffMs / (1000 * 60));
        const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
        
        // Show minutes if less than 1 hour, otherwise show hours
        const timeText = diffMinutes < 60 
          ? `${diffMinutes}m`
          : `${diffHours}h`;
        
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-primary text-primary-foreground shadow-sm">
            <Clock className="h-3 w-3" />
            Wait ({timeText})
          </span>
        );
      }
    }

    // Check if last executed block was an email
    const executedBlockIds = execution.metadata?.executedBlockIds || [];
    if (executedBlockIds.length > 0) {
      const blocks = execution.metadata?.blocks || [];
      const lastExecutedBlock = blocks.find((b: any) => b.id === executedBlockIds[executedBlockIds.length - 1]);
      if (lastExecutedBlock?.type === 'email') {
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-indigo-500 text-white shadow-sm">
            <Mail className="h-3 w-3" />
            Email sent
          </span>
        );
      }
    }

    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-slate-600 text-white shadow-sm">
        <Play className="h-3 w-3" />
        Active
      </span>
    );
  };

  const getCurrentStep = (execution: CadenceExecution & { currentBlock?: any }) => {
    if (!execution.currentBlock) {
      return 'Unknown step';
    }

    const blockType = execution.currentBlock.type;
    const blockTitle = execution.currentBlock.title || 'Untitled';

    switch (blockType) {
      case 'trigger':
        return 'Starting...';
      case 'email':
        return `Email: ${blockTitle}`;
      case 'delay':
        return `Waiting: ${blockTitle}`;
      case 'calendar':
        return `Calendar: ${blockTitle}`;
      case 'voice_call':
        return `Call: ${blockTitle}`;
      case 'conditional':
        return `Condition: ${blockTitle}`;
      case 'end':
        return 'Completed';
      default:
        return blockTitle;
    }
  };

  const getBlockTypeIcon = (blockType: string) => {
    switch (blockType) {
      case 'email':
        return <Mail className="h-4 w-4 text-indigo-600" />;
      case 'delay':
        return <Clock className="h-4 w-4 text-primary" />;
      case 'calendar':
        return <Clock className="h-4 w-4 text-emerald-600" />;
      case 'voice_call':
        return <Play className="h-4 w-4 text-purple-600" />;
      default:
        return <Play className="h-4 w-4 text-foreground/70" />;
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">Loading outreach...</div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="border-b-2 border-border bg-background px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-foreground">Current Outreach</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Cadence executions ({executions.length})
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {executions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="text-muted-foreground">
              No active outreach cadences. Start a cadence from the Companies page.
            </div>
          </div>
        ) : (
          <div className="h-full overflow-auto p-8">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 z-10 bg-background border-b-2 border-border">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                    COMPANY
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                    CADENCE
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                    CONTACT
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                    STATUS
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                    CURRENT STEP
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                    ACTIONS
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-border">
                {executions.map((execution, index) => {
                  return (
                    <motion.tr
                      key={execution.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.02 }}
                      className="group hover:bg-accent/50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="font-medium text-foreground">
                          {execution.companyCadence?.company?.name || 'Unknown Company'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-foreground">
                          {execution.companyCadence?.cadence?.name || 'Unknown Cadence'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-muted-foreground">
                          {execution.contact?.email || 'No contact'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(execution)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {execution.currentBlock && getBlockTypeIcon(execution.currentBlock.type)}
                          <span className="text-sm text-foreground">
                            {getCurrentStep(execution)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Button
                          onClick={() => deleteExecution(execution.id)}
                          disabled={deletingId === execution.id}
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
