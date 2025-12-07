"use client";

import { useState, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Edit, Trash2, Play, User, X } from "lucide-react";
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
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.error('No user found');
        setCadences([]);
        return;
      }

      // All cadences are shared company-wide - no user filter
      const { data, error } = await supabase
        .from('cadences')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;

      // Fetch companies and contacts for each cadence
      const cadencesWithData = await Promise.all((data || []).map(async (cadence) => {
        const nodes = cadence.nodes || [];
        
        // Ensure nodes is an array
        const nodesArray = Array.isArray(nodes) ? nodes : [];
        
        // Filter out invalid blocks and deduplicate by ID
        const validBlocks = nodesArray.filter((block: any, index: number, self: any[]) => {
          if (!block || typeof block !== 'object' || !block.id || !block.type) {
            return false;
          }
          // Deduplicate by ID (keep first occurrence)
          return self.findIndex(b => b.id === block.id) === index;
        });
        
        // Fetch companies and contacts for this cadence
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
        
        if (ccError) {
          console.error(`Error fetching companies for cadence ${cadence.id}:`, ccError);
        }
        
        // Transform companyCadences to match CompanyCadenceInfo type
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

  // Check if we should auto-open a cadence for editing (from company page)
  useEffect(() => {
    const editCadenceId = searchParams?.get('edit');
    const companyId = searchParams?.get('companyId');
    if (editCadenceId && cadences.length > 0) {
      const cadence = cadences.find(c => c.id === editCadenceId);
      if (cadence) {
        setEditingCadence({ ...cadence, companyId } as any);
        setShowFlowBuilder(true);
        // Clean up URL
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
      
      // Fetch companies in this cadence with their contacts
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
      console.error('Error fetching companies:', error);
      alert(`Error: ${error.message}`);
    }
  };

  const handleSaveFlow = async (blocks: FlowBlock[], name?: string, description?: string) => {
    try {
      // Get current user
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

      // Check if we're editing an existing cadence
      if (editingCadence && editingCadence.id) {
        // Update existing cadence in Supabase (all cadences are shared)
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

        // Update local state
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
        // Check if a cadence with this name already exists
        const { data: existingCadences } = await supabase
          .from('cadences')
          .select('id, name')
          .eq('name', cadenceName)
          .limit(1);

        if (existingCadences && existingCadences.length > 0) {
          // Update existing cadence instead of creating duplicate
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

          // Update local state
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
          // Create new cadence in Supabase
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

          // Update local state
          setCadences(prev => [...prev, {
            ...data,
            blocks: data.nodes || [],
          }]);
        }
      }
      
      // Mark as saved and clear unsaved changes
      setHasUnsavedChanges(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      
      // Don't refetch - we already updated local state above
    } catch (error) {
      console.error('Error saving cadence:', error);
      alert('Failed to save cadence. Please try again.');
    }
  };

  const handleRunCadence = async (cadenceId: string) => {
    try {
      console.log('[Run Cadence] Starting...', cadenceId);
      setRunningCadenceId(cadenceId);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        alert('You must be signed in to run cadences');
        setRunningCadenceId(null);
        return;
      }
      
      console.log('[Run Cadence] User found:', user.email);

      // Test email and phone
      const testEmail = 'ethanzzheng@gmail.com';
      const testPhone = '+19255772134';

      // First, find or create a test company
      let testCompanyId: string;
      
      // Try to find existing test company
      const { data: existingCompany } = await supabase
        .from('companies')
        .select('id')
        .eq('email', testEmail)
        .single();

      if (existingCompany) {
        testCompanyId = existingCompany.id;
        // Update phone number if needed
        await supabase
          .from('companies')
          .update({ phone_number: testPhone })
          .eq('id', testCompanyId);
      } else {
        // Create test company
        const { data: newCompany, error: createError } = await supabase
          .from('companies')
          .insert({
            name: 'Test Company (Cadence Test)',
            email: testEmail,
            phone_number: testPhone,
          })
          .select()
          .single();

        if (createError) throw createError;
        testCompanyId = newCompany.id;
      }

      // Add company to cadence (or get existing association)
      let companyCadenceId: string;
      
      const { data: existingAssociation } = await supabase
        .from('company_cadences')
        .select('id')
        .eq('company_id', testCompanyId)
        .eq('cadence_id', cadenceId)
        .single();

      if (existingAssociation) {
        companyCadenceId = existingAssociation.id;
        // Reset status to active
        await supabase
          .from('company_cadences')
          .update({ status: 'active', completed_at: null })
          .eq('id', companyCadenceId);
      } else {
        // Create new association
        const { data: newAssociation, error: assocError } = await supabase
          .from('company_cadences')
          .insert({
            company_id: testCompanyId,
            cadence_id: cadenceId,
            status: 'active',
          })
          .select()
          .single();

        if (assocError) throw assocError;
        companyCadenceId = newAssociation.id;
      }

      // Start the cadence
      console.log('[Run Cadence] Calling API with company_cadence_id:', companyCadenceId);
      
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      let response: Response;
      try {
        response = await fetch('/api/cadence/start', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ company_cadence_id: companyCadenceId }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          throw new Error('Request timed out after 30 seconds. Please check server logs.');
        }
        throw new Error(`Network error: ${fetchError.message}`);
      }

      console.log('[Run Cadence] Response status:', response.status, response.statusText);

      if (!response.ok) {
        let errorMessage = 'Failed to start cadence';
        try {
          const error = await response.json();
          console.error('[Run Cadence] API Error:', error);
          errorMessage = error.error || error.message || errorMessage;
        } catch (e) {
          console.error('[Run Cadence] Failed to parse error response:', e);
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      let result: any;
      try {
        result = await response.json();
        console.log('[Run Cadence] Success! Result:', result);
      } catch (jsonError) {
        console.error('[Run Cadence] Failed to parse JSON response:', jsonError);
        throw new Error('Invalid response from server');
      }
      console.log('✅ Cadence started:', result);
      console.log('📋 Execution ID:', result.execution_id);
      console.log('🔍 Check browser console for detailed threading logs');
      console.log('📧 Look for logs starting with [Workflow] and [Email]');
      
      // Poll for execution status
      const executionId = result.execution_id;
      let pollCount = 0;
      const maxPolls = 20; // Poll for 10 seconds (20 * 500ms)
      
      const pollStatus = async () => {
        try {
          const statusResponse = await fetch(`/api/cadence/execution-status?execution_id=${executionId}`);
          if (statusResponse.ok) {
            const status = await statusResponse.json();
            console.log(`\n📊 Execution Status (poll ${pollCount + 1}/${maxPolls}):`, {
              status: status.status,
              current_block: status.current_block_id,
              threadInfoMap: status.threadInfoMap,
              threadInfoMapSize: Object.keys(status.threadInfoMap || {}).length
            });
            
            if (Object.keys(status.threadInfoMap || {}).length > 0) {
              console.log('✅ Thread Info Map populated!', status.threadInfoMap);
            }
          }
        } catch (e) {
          // Ignore polling errors
        }
        
        pollCount++;
        if (pollCount < maxPolls) {
          setTimeout(pollStatus, 500);
        }
      };
      
      setTimeout(pollStatus, 1000); // Start polling after 1 second
      
      // Show success message
      if (result.execution_id) {
        alert(`Cadence started!\n\nExecution ID: ${result.execution_id}\n\nCheck browser console (F12) for detailed status.\nServer logs are in the terminal running "npm run dev"`);
      } else {
        alert(`Cadence started!\n\nCheck browser console (F12) for detailed status.\nServer logs are in the terminal running "npm run dev"`);
      }
      setRunningCadenceId(null);
    } catch (error: any) {
      console.error('[Run Cadence] Error:', error);
      console.error('[Run Cadence] Error details:', {
        message: error.message,
        stack: error.stack,
        response: error.response,
        name: error.name,
      });
      
      // Always show error alert
      const errorMessage = error.message || 'Failed to run cadence. Check console for details.';
      alert(`Error: ${errorMessage}\n\nCheck browser console (F12) for more details.`);
      setRunningCadenceId(null);
    }
  };

  const handleDeleteCadence = async (cadenceId: string) => {
    if (!confirm('Are you sure you want to delete this cadence?')) {
      return;
    }

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        alert('You must be signed in to delete cadences');
        return;
      }

      // All cadences are shared company-wide - anyone can delete
      const { error } = await supabase
        .from('cadences')
        .delete()
        .eq('id', cadenceId);

      if (error) throw error;

      // Update local state
      setCadences(prev => prev.filter(c => c.id !== cadenceId));
    } catch (error) {
      console.error('Error deleting cadence:', error);
      alert('Failed to delete cadence. Please try again.');
    }
  };

  const handleCloseFlowBuilder = useCallback(async (force = false, saveData?: { blocks: FlowBlock[], name?: string, description?: string }) => {
    if (!force && hasUnsavedChanges) {
      // Show custom dialog with Save/Don't Save/Cancel options
      const result = window.confirm('Do you want to save your changes before closing?\n\nClick OK to save, or Cancel to discard changes.');
      
      if (result) {
        // User wants to save - call handleSaveFlow with the current data
        if (saveData) {
          await handleSaveFlow(saveData.blocks, saveData.name, saveData.description);
        } else {
          alert('Cannot save: No data provided');
          return;
        }
      }
      // If user clicks Cancel on the confirm, we treat it as "Don't Save" and continue closing
    }
    setShowFlowBuilder(false);
    setEditingCadence(null);
    setHasUnsavedChanges(false);
    setSaveSuccess(false);
  }, [hasUnsavedChanges]);

  // Handle Escape key to close modal
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

  // Hide sidebar when modal is open
  useEffect(() => {
    if (showFlowBuilder) {
      // Add class immediately to hide sidebar
      document.body.classList.add('modal-open');
    } else {
      // Delay removing class slightly to coordinate with modal exit animation
      const timer = setTimeout(() => {
        document.body.classList.remove('modal-open');
      }, 100); // Small delay to let modal start fading out first
      return () => clearTimeout(timer);
    }
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [showFlowBuilder]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600">Loading cadences...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-background min-h-screen" style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
      {/* Header */}
      <div className="bg-background">
        <div className="max-w-7xl mx-auto px-8 pt-6 pb-2">
          <div className="mb-8 pt-0 flex items-center justify-between">
            <h1 className="text-2xl font-semibold text-gray-900 leading-6">Cadences</h1>
            <Button
              onClick={handleCreateCadence}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              <Plus className="h-4 w-4" />
              Create Cadence
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1">
        <div className="max-w-7xl mx-auto px-8 pb-6">
          <div>
            <table className="w-full border-collapse">
              <thead className="bg-background">
                <tr>
                  <th className="px-7 py-4 text-left text-sm font-semibold text-gray-900 select-none">
                    Name
                  </th>
                  <th className="px-7 py-4 text-left text-sm font-semibold text-gray-900 select-none">
                    Description
                  </th>
                  <th className="px-7 py-4 text-left text-sm font-semibold text-gray-900 select-none">
                    Updated
                  </th>
                  <th className="px-7 py-4 text-right text-sm font-semibold text-gray-900 select-none">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {cadences.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-7 py-12 text-center">
                      <div className="text-gray-600">
                        No cadences yet. Create your first cadence to get started.
                      </div>
                    </td>
                  </tr>
                ) : (
                  cadences.map((cadence, index) => (
                    <motion.tr
                      key={cadence.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.02 }}
                      className="group hover:bg-indigo-50/50 transition-colors border-b border-gray-100"
                    >
                      <td className="px-7 py-5 text-sm">
                        <div className="text-base font-medium text-gray-900 truncate leading-6">
                          {cadence.name}
                        </div>
                      </td>
                      <td className="px-7 py-5 text-sm">
                        <div className="text-sm text-gray-600 max-w-md truncate leading-5">
                          {cadence.description || '-'}
                        </div>
                      </td>
                      <td className="px-7 py-5 text-sm">
                        <div className="text-sm text-gray-600 leading-5">
                          {new Date(cadence.updated_at).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-7 py-5 text-sm text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditCadence(cadence)}
                            className="h-8 text-xs border-gray-200 hover:bg-gray-50"
                          >
                            <Edit className="h-3.5 w-3.5 mr-1.5" />
                            Edit
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleDeleteCadence(cadence.id)}
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Flow Builder Modal */}
      <AnimatePresence>
        {showFlowBuilder && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            onClick={() => handleCloseFlowBuilder()}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-background rounded-lg shadow-xl w-full max-w-[95vw] h-[90vh] flex flex-col overflow-hidden"
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
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            onClick={() => setShowCompaniesModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-background rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden"
            >
              <div className="p-6 border-b flex items-center justify-between">
                <h2 className="text-xl font-semibold">Companies in Cadence</h2>
                <Button variant="ghost" size="sm" onClick={() => setShowCompaniesModal(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                {cadenceCompanies.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No companies in this cadence yet</p>
                ) : (
                  <div className="space-y-4">
                    {cadenceCompanies.map((cc: any) => (
                      <div
                        key={cc.id}
                        className="p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg">{cc.company?.name || 'Unknown Company'}</h3>
                            {cc.contact ? (
                              <div className="mt-3 p-2 bg-blue-50 rounded border border-blue-200">
                                <p className="text-sm font-medium text-blue-900">
                                  Represented by: {cc.contact.first_name} {cc.contact.last_name}
                                </p>
                                {cc.contact.position && (
                                  <p className="text-xs text-blue-700 mt-1">{cc.contact.position}</p>
                                )}
                                {cc.contact.email && (
                                  <p className="text-xs text-blue-600 mt-1">{cc.contact.email}</p>
                                )}
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground mt-2">No contact assigned</p>
                            )}
                            <div className="mt-2">
                              <span className={`text-xs px-2 py-1 rounded ${
                                cc.status === 'active' ? 'bg-green-100 text-green-800' :
                                cc.status === 'completed' ? 'bg-gray-100 text-gray-800' :
                                'bg-yellow-100 text-yellow-800'
                              }`}>
                                {cc.status}
                              </span>
                            </div>
                          </div>
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
  );
}
