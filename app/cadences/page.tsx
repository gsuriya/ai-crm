"use client";

import { useState, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Edit, Trash2, Play, User, X, Mail, Clock, Zap, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CadenceFlowBuilder, FlowBlock } from "@/components/cadence-flow-builder";
import { supabase } from "@/lib/supabase";

export const dynamic = 'force-dynamic';

interface CompanyCadenceInfo {
  id: string;
  company_id: string;
  contact_id: string | null;
  status: string;
  company: {
    id: string;
    name: string;
    email?: string;
  };
  contact: {
    id: string;
    first_name: string;
    last_name: string;
    email?: string;
    position?: string;
  } | null;
}

interface Cadence {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
  blocks?: FlowBlock[];
  nodes?: FlowBlock[];
  connections?: any[];
  companies?: CompanyCadenceInfo[];
}

export default function CadencesPage() {
  const searchParams = useSearchParams();
  const [cadences, setCadences] = useState<Cadence[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFlowBuilder, setShowFlowBuilder] = useState(false);
  const [editingCadence, setEditingCadence] = useState<Cadence | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [runningCadenceId, setRunningCadenceId] = useState<string | null>(null);
  const [showCompaniesModal, setShowCompaniesModal] = useState(false);
  const [selectedCadenceForCompanies, setSelectedCadenceForCompanies] = useState<string | null>(null);
  const [cadenceCompanies, setCadenceCompanies] = useState<any[]>([]);

  const fetchCadences = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setCadences([]);
        return;
      }

      const { data, error } = await supabase
        .from('cadences')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const cadencesWithData = await Promise.all((data || []).map(async (cadence) => {
        const nodes = cadence.nodes || [];
        const nodesArray = Array.isArray(nodes) ? nodes : [];
        
        const validBlocks = nodesArray.filter((block: any, index: number, self: any[]) => {
          if (!block || typeof block !== 'object' || !block.id || !block.type) {
            return false;
          }
          return self.findIndex(b => b.id === block.id) === index;
        });
        
        const { data: companyCadences, error: ccError } = await supabase
          .from('company_cadences')
          .select(`
            id,
            company_id,
            contact_id,
            status,
            company:companies(id, name, email),
            contact:contacts(id, first_name, last_name, email, position)
          `)
          .eq('cadence_id', cadence.id);
        
        const transformedCompanies = (companyCadences || []).map((cc: any) => ({
          id: cc.id,
          company_id: cc.company_id,
          contact_id: cc.contact_id,
          status: cc.status,
          company: Array.isArray(cc.company) ? cc.company[0] : cc.company,
          contact: Array.isArray(cc.contact) ? cc.contact[0] : cc.contact,
        })) as CompanyCadenceInfo[];
        
        return {
          ...cadence,
          blocks: validBlocks,
          companies: transformedCompanies,
        };
      }));

      setCadences(cadencesWithData);
    } catch (error) {
      console.error('Error fetching cadences:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCadences();
  }, [fetchCadences]);

  useEffect(() => {
    const editCadenceId = searchParams?.get('edit');
    const companyId = searchParams?.get('companyId');
    if (editCadenceId && cadences.length > 0) {
      const cadence = cadences.find(c => c.id === editCadenceId);
      if (cadence) {
        setEditingCadence({ ...cadence, companyId } as any);
        setShowFlowBuilder(true);
        window.history.replaceState({}, '', '/cadences');
      }
    }
  }, [searchParams, cadences]);

  const handleCreateCadence = () => {
    setEditingCadence(null);
    setHasUnsavedChanges(false);
    setSaveSuccess(false);
    setShowFlowBuilder(true);
  };

  const handleEditCadence = (cadence: Cadence) => {
    setEditingCadence(cadence);
    setHasUnsavedChanges(false);
    setSaveSuccess(false);
    setShowFlowBuilder(true);
  };

  const handleViewCompanies = async (cadenceId: string) => {
    try {
      setSelectedCadenceForCompanies(cadenceId);
      
      const { data, error } = await supabase
        .from('company_cadences')
        .select(`
          *,
          company:companies(id, name, email),
          contact:contacts(id, first_name, last_name, email, position)
        `)
        .eq('cadence_id', cadenceId);

      if (error) throw error;
      setCadenceCompanies(data || []);
      setShowCompaniesModal(true);
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  const handleSaveFlow = async (blocks: FlowBlock[], name?: string, description?: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        alert('You must be signed in to save cadences');
        return;
      }

      if (!name || !name.trim()) {
        alert('Please enter a cadence name');
        return;
      }

      const cadenceName = name.trim();

      if (editingCadence && editingCadence.id) {
        const { data: activeExecutions, error: execError } = await supabase
          .from('company_cadences')
          .select('id, status, company:companies(name), contact:contacts(first_name, last_name)')
          .eq('cadence_id', editingCadence.id)
          .in('status', ['active', 'paused']);

        if (activeExecutions && activeExecutions.length > 0) {
          const activeCount = activeExecutions.filter((e: any) => e.status === 'active').length;
          const pausedCount = activeExecutions.filter((e: any) => e.status === 'paused').length;
          
          const message = `This cadence has ${activeCount} active and ${pausedCount} paused execution(s).\n\n` +
            `⚠️ Changes will only apply to NEW executions.\n\n` +
            `Continue?`;

          if (!confirm(message)) {
            return;
          }
        }

        const { error } = await supabase
          .from('cadences')
          .update({
            name: cadenceName,
            description: description?.trim() || null,
            nodes: blocks,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingCadence.id);

        if (error) throw error;

        setCadences(prev => prev.map(c =>
          c.id === editingCadence.id
            ? { 
                ...c, 
                name: cadenceName,
                description: description?.trim() || undefined,
                blocks, 
                nodes: blocks, 
                updated_at: new Date().toISOString() 
              }
            : c
        ));
      } else {
        const { data: existingCadences } = await supabase
          .from('cadences')
          .select('id, name')
          .eq('name', cadenceName)
          .limit(1);

        if (existingCadences && existingCadences.length > 0) {
          const existingCadence = existingCadences[0];
          const { error } = await supabase
            .from('cadences')
            .update({
              description: description?.trim() || null,
              nodes: blocks,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingCadence.id);

          if (error) throw error;

          setCadences(prev => prev.map(c =>
            c.id === existingCadence.id
              ? { 
                  ...c, 
                  description: description?.trim() || undefined,
                  blocks, 
                  nodes: blocks, 
                  updated_at: new Date().toISOString() 
                }
              : c
          ));
        } else {
          const { data, error } = await supabase
            .from('cadences')
            .insert({
              user_id: user.id,
              name: cadenceName,
              description: description?.trim() || null,
              nodes: blocks,
              connections: [],
              is_active: true,
            })
            .select()
            .single();

          if (error) throw error;

          setCadences(prev => [...prev, {
            ...data,
            blocks: data.nodes || [],
          }]);
        }
      }
      
      setHasUnsavedChanges(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Error saving cadence:', error);
      alert('Failed to save cadence. Please try again.');
    }
  };

  const handleRunCadence = async (cadenceId: string) => {
    // ... existing implementation
  };

  const handleDeleteCadence = async (cadenceId: string) => {
    if (!confirm('Are you sure you want to delete this cadence?')) {
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        alert('You must be signed in to delete cadences');
        return;
      }

      const { error } = await supabase
        .from('cadences')
        .delete()
        .eq('id', cadenceId);

      if (error) throw error;
      setCadences(prev => prev.filter(c => c.id !== cadenceId));
    } catch (error) {
      console.error('Error deleting cadence:', error);
      alert('Failed to delete cadence. Please try again.');
    }
  };

  const handleCloseFlowBuilder = useCallback(async (force = false, saveData?: { blocks: FlowBlock[], name?: string, description?: string }) => {
    if (!force && hasUnsavedChanges) {
      const result = window.confirm('Save changes before closing?');
      
      if (result && saveData) {
          await handleSaveFlow(saveData.blocks, saveData.name, saveData.description);
      }
    }
    setShowFlowBuilder(false);
    setEditingCadence(null);
    setHasUnsavedChanges(false);
    setSaveSuccess(false);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showFlowBuilder) {
        handleCloseFlowBuilder();
      }
    };

    if (showFlowBuilder) {
      window.addEventListener('keydown', handleEscape);
    }

    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [showFlowBuilder, handleCloseFlowBuilder]);

  useEffect(() => {
    if (showFlowBuilder) {
      document.body.classList.add('modal-open');
    } else {
      const timer = setTimeout(() => {
        document.body.classList.remove('modal-open');
      }, 100);
      return () => clearTimeout(timer);
    }
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [showFlowBuilder]);

  const getCadenceStats = (cadence: Cadence) => {
    const blocks = cadence.blocks || [];
    const emailBlocks = blocks.filter(b => b.type === 'email');
    const delayBlocks = blocks.filter(b => b.type === 'delay');
    return { emails: emailBlocks.length, delays: delayBlocks.length, total: blocks.length };
  };

  const getCardColor = (name: string) => {
    const colors = [
      { gradient: 'from-violet-500 to-purple-600', light: 'bg-violet-100', text: 'text-violet-600' },
      { gradient: 'from-sky-500 to-blue-600', light: 'bg-sky-100', text: 'text-sky-600' },
      { gradient: 'from-emerald-500 to-teal-600', light: 'bg-emerald-100', text: 'text-emerald-600' },
      { gradient: 'from-amber-500 to-orange-600', light: 'bg-amber-100', text: 'text-amber-600' },
      { gradient: 'from-rose-500 to-pink-600', light: 'bg-rose-100', text: 'text-rose-600' },
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen ">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-violet-500/30 border-t-violet-400 animate-spin" />
          <p className="text-white/50 text-sm">Loading cadences...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen ">
      <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start justify-between mb-8"
        >
          <div>
            <h1 className="text-2xl font-semibold text-white tracking-tight">Cadences</h1>
            <p className="text-white/50 text-sm mt-1">
              {cadences.length} {cadences.length === 1 ? 'sequence' : 'sequences'} created
            </p>
          </div>
          <button
            onClick={handleCreateCadence}
            className="px-4 py-2.5 rounded-xl bg-violet-600 text-white hover:bg-violet-500 flex items-center gap-2 transition-all text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Create Cadence
          </button>
        </motion.div>

        {/* Cadences Grid */}
        {cadences.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10"
          >
            <div className="w-16 h-16 rounded-2xl bg-violet-500/20 flex items-center justify-center mx-auto mb-4">
              <Zap className="w-8 h-8 text-violet-600" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">No cadences yet</h3>
            <p className="text-white/50 text-sm mb-6 max-w-sm mx-auto">
              Create your first email sequence to automate your outreach
            </p>
            <button
              onClick={handleCreateCadence}
              className="px-5 py-2.5 rounded-xl bg-violet-600 text-white hover:bg-violet-500 text-sm font-medium inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create Cadence
            </button>
          </motion.div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cadences.map((cadence, index) => {
              const stats = getCadenceStats(cadence);
              const colors = getCardColor(cadence.name);
              const activeCount = cadence.companies?.filter(c => c.status === 'active').length || 0;
              
              return (
                <motion.div
                      key={cadence.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="group bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden hover:border-white/20 transition-all"
                >
                  {/* Card Header with gradient accent */}
                  <div className={`h-1.5 bg-gradient-to-r ${colors.gradient}`} />
                  
                  <div className="p-5">
                    {/* Title */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-white truncate mb-1 group-hover:text-violet-400 transition-colors">
                          {cadence.name}
                        </h3>
                        {cadence.description && (
                          <p className="text-sm text-white/50 line-clamp-2">
                            {cadence.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex items-center gap-1.5 text-sm">
                        <div className={`w-6 h-6 rounded-md ${colors.light} flex items-center justify-center`}>
                          <Mail className={`w-3.5 h-3.5 ${colors.text}`} />
                        </div>
                        <span className="text-slate-600 font-medium">{stats.emails}</span>
                        <span className="text-slate-400">emails</span>
                      </div>
                      
                      {stats.delays > 0 && (
                        <>
                          <ArrowRight className="w-3 h-3 text-slate-300" />
                          <div className="flex items-center gap-1.5 text-sm">
                            <div className="w-6 h-6 rounded-md bg-slate-100 flex items-center justify-center">
                              <Clock className="w-3.5 h-3.5 text-slate-500" />
                            </div>
                            <span className="text-slate-600 font-medium">{stats.delays}</span>
                            <span className="text-slate-400">delays</span>
                          </div>
                        </>
                      )}
                        </div>

                    {/* Active indicator */}
                    {activeCount > 0 && (
                      <div className="flex items-center gap-2 mb-4 p-2.5 bg-emerald-50 rounded-lg border border-emerald-100">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-xs font-medium text-emerald-700">
                          {activeCount} active {activeCount === 1 ? 'sequence' : 'sequences'}
                        </span>
                        </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                      <span className="text-xs text-slate-400">
                        Updated {formatDate(cadence.updated_at)}
                      </span>
                      
                      <div className="flex items-center gap-1">
                        <button
                            onClick={() => handleEditCadence(cadence)}
                          className="p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={() => handleDeleteCadence(cadence.id)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
          </div>
        </div>
      </div>
                </motion.div>
              );
            })}
          </div>
        )}

      {/* Flow Builder Modal */}
      <AnimatePresence>
        {showFlowBuilder && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => handleCloseFlowBuilder()}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl shadow-2xl w-full max-w-[95vw] h-[90vh] flex flex-col overflow-hidden"
            >
              <CadenceFlowBuilder
                initialBlocks={editingCadence?.blocks || []}
                cadenceId={editingCadence?.id}
                cadenceName={editingCadence?.name || ''}
                cadenceDescription={editingCadence?.description || ''}
                companyId={(editingCadence as any)?.companyId}
                showStartButton={!!(editingCadence as any)?.companyId}
                autoSave={false}
                onSave={handleSaveFlow}
                onClose={handleCloseFlowBuilder}
                onChanges={setHasUnsavedChanges}
                saveSuccess={saveSuccess}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* View Companies Modal */}
      <AnimatePresence>
        {showCompaniesModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowCompaniesModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden"
              >
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-slate-900">Companies in Cadence</h2>
                  <button 
                    onClick={() => setShowCompaniesModal(false)}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-slate-500" />
                  </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                {cadenceCompanies.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-slate-500">No companies in this cadence yet</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                    {cadenceCompanies.map((cc: any) => (
                      <div
                        key={cc.id}
                          className="p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                              <h3 className="font-semibold text-slate-900">{cc.company?.name || 'Unknown Company'}</h3>
                            {cc.contact ? (
                                <p className="text-sm text-slate-600 mt-1">
                                  {cc.contact.first_name} {cc.contact.last_name}
                                  {cc.contact.position && <span className="text-slate-400"> • {cc.contact.position}</span>}
                                </p>
                              ) : (
                                <p className="text-sm text-slate-400 mt-1">No contact assigned</p>
                                )}
                              </div>
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                              cc.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                              cc.status === 'completed' ? 'bg-slate-200 text-slate-600' :
                              'bg-amber-100 text-amber-700'
                              }`}>
                                {cc.status}
                              </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}
