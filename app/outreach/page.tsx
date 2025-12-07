"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Building2, User, Mail, Clock, CheckCircle, XCircle, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

export const dynamic = 'force-dynamic';

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
  company: {
    id: string;
    name: string;
  };
  contact: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  } | null;
  cadence: {
    id: string;
    name: string;
    nodes: any[];
  };
}

export default function OutreachPage() {
  const [outreach, setOutreach] = useState<OutreachItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupBy, setGroupBy] = useState<'company' | 'person'>('company');

  useEffect(() => {
    fetchOutreach();
  }, []);

  const fetchOutreach = async () => {
    try {
      setLoading(true);
      
      // Get all company_cadences with their related data
      const { data, error } = await supabase
        .from('company_cadences')
        .select(`
          id,
          company_id,
          contact_id,
          cadence_id,
          status,
          company:companies(id, name),
          contact:contacts(id, first_name, last_name, email),
          cadence:cadences(id, name, nodes)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get execution data for each company_cadence
      const companyCadenceIds = data?.map(cc => cc.id) || [];
      const { data: executions } = await supabase
        .from('cadence_executions')
        .select('*')
        .in('company_cadence_id', companyCadenceIds);

      // Map executions by company_cadence_id
      const executionsMap = new Map();
      executions?.forEach(exec => {
        executionsMap.set(exec.company_cadence_id, exec);
      });

      // Transform data
      const transformedData: OutreachItem[] = (data || []).map((item: any) => {
        const execution = executionsMap.get(item.id);
        const cadenceBlocks = item.cadence?.nodes || [];
        const emailBlocks = cadenceBlocks.filter((b: any) => b.type === 'email');
        const executedBlockIds = execution?.metadata?.executedBlockIds || [];
        const currentStep = executedBlockIds.length;
        const totalSteps = emailBlocks.length;

        // Determine last action
        let lastAction = 'Not started';
        let lastActionDate = item.created_at;
        
        if (currentStep > 0) {
          const lastBlockId = executedBlockIds[executedBlockIds.length - 1];
          const lastBlock = cadenceBlocks.find((b: any) => b.id === lastBlockId);
          if (lastBlock) {
            if (lastBlock.type === 'email') {
              lastAction = `Sent: ${lastBlock.title || 'Email'}`;
            } else if (lastBlock.type === 'delay') {
              lastAction = `Waiting ${lastBlock.config?.delayDays || 0}d`;
            }
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
          responded: false, // TODO: Check for email replies
          company: Array.isArray(item.company) ? item.company[0] : item.company,
          contact: Array.isArray(item.contact) ? item.contact[0] : item.contact,
          cadence: Array.isArray(item.cadence) ? item.cadence[0] : item.cadence,
        };
      });

      setOutreach(transformedData);
    } catch (error) {
      console.error('Error fetching outreach:', error);
    } finally {
      setLoading(false);
    }
  };

  // Group by company
  const groupedByCompany = outreach.reduce((acc, item) => {
    const companyName = item.company?.name || 'Unknown Company';
    if (!acc[companyName]) {
      acc[companyName] = [];
    }
    acc[companyName].push(item);
    return acc;
  }, {} as Record<string, OutreachItem[]>);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-blue-600 bg-blue-50';
      case 'completed': return 'text-green-600 bg-green-50';
      case 'paused': return 'text-yellow-600 bg-yellow-50';
      case 'error': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusIcon = (status: string, responded: boolean) => {
    if (responded) return <CheckCircle className="h-4 w-4 text-green-600" />;
    switch (status) {
      case 'active': return <Clock className="h-4 w-4 text-blue-600" />;
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'paused': return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-600" />;
      default: return <Mail className="h-4 w-4 text-gray-600" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Ongoing Outreach</h1>
          <p className="text-gray-600 mt-1">Track your cadence progress and responses</p>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => setGroupBy('company')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              groupBy === 'company' 
                ? 'bg-black text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Building2 className="h-4 w-4 inline mr-2" />
            By Company
          </button>
          <button
            onClick={() => setGroupBy('person')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              groupBy === 'person' 
                ? 'bg-black text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <User className="h-4 w-4 inline mr-2" />
            By Person
          </button>
        </div>
      </div>

      {outreach.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No active outreach</h3>
          <p className="text-gray-600">Start a cadence to begin tracking your outreach here.</p>
        </div>
      ) : groupBy === 'company' ? (
        <div className="space-y-6">
          {Object.entries(groupedByCompany).map(([companyName, items]) => (
            <motion.div
              key={companyName}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-lg border border-gray-200 overflow-hidden"
            >
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Building2 className="h-5 w-5 text-gray-600" />
                    <h2 className="text-lg font-semibold">{companyName}</h2>
                    <span className="text-sm text-gray-500">
                      {items.length} {items.length === 1 ? 'person' : 'people'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="divide-y divide-gray-100">
                {items.map((item) => (
                  <div key={item.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(item.status, item.responded)}
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <span className="font-medium">
                              {item.contact ? `${item.contact.first_name} ${item.contact.last_name}` : 'Unknown Contact'}
                            </span>
                            {item.contact?.email && (
                              <span className="text-sm text-gray-500">{item.contact.email}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-sm text-gray-600">
                            <span className="font-medium">{item.cadence?.name || 'Unknown Cadence'}</span>
                            <ArrowRight className="h-3 w-3" />
                            <span>{item.last_action}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <div className="text-sm font-medium text-gray-900">
                            Step {item.current_step} of {item.total_steps}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {new Date(item.last_action_date).toLocaleDateString()}
                          </div>
                        </div>

                        <div>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                            {item.responded ? 'Responded' : item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Company
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cadence
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Progress
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Action
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {outreach.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {item.contact ? `${item.contact.first_name} ${item.contact.last_name}` : 'Unknown'}
                        </div>
                        <div className="text-sm text-gray-500">{item.contact?.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{item.company?.name || 'Unknown'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{item.cadence?.name || 'Unknown'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      Step {item.current_step} of {item.total_steps}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{item.last_action}</div>
                    <div className="text-xs text-gray-500">
                      {new Date(item.last_action_date).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1 ${getStatusColor(item.status)}`}>
                      {getStatusIcon(item.status, item.responded)}
                      {item.responded ? 'Responded' : item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
