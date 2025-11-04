"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Edit, Trash2, Clock, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CadenceFlowBuilder, FlowBlock } from "@/components/cadence-flow-builder";
import { supabase } from "@/lib/supabase";
import { X } from "lucide-react";

export const dynamic = 'force-dynamic';

interface Cadence {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
  blocks?: FlowBlock[];
  nodes?: FlowBlock[];
  connections?: any[];
}

export default function CadencesPage() {
  const [cadences, setCadences] = useState<Cadence[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFlowBuilder, setShowFlowBuilder] = useState(false);
  const [editingCadence, setEditingCadence] = useState<Cadence | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

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

      // Convert nodes JSONB to blocks
      const cadencesWithBlocks = (data || []).map(cadence => {
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
        
        // Debug logging for the "yo" cadence
        if (cadence.description === 'yo' || cadence.name?.toLowerCase().includes('yo')) {
          console.log(`[Cadences] Debugging cadence "${cadence.name}":`, {
            nodesLength: nodesArray.length,
            validBlocksLength: validBlocks.length,
            nodes: nodesArray.map((b: any) => ({ id: b?.id, type: b?.type, title: b?.title })),
            validBlocks: validBlocks.map((b: any) => ({ id: b?.id, type: b?.type, title: b?.title })),
          });
        }
        
        return {
          ...cadence,
          blocks: validBlocks,
        };
      });

      setCadences(cadencesWithBlocks);
    } catch (error) {
      console.error('Error fetching cadences:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCadences();
  }, [fetchCadences]);

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

  const handleSaveFlow = async (blocks: FlowBlock[], name?: string, description?: string) => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        alert('You must be signed in to save cadences');
        return;
      }

      if (editingCadence) {
        // Update existing cadence in Supabase (all cadences are shared)
        const { error } = await supabase
          .from('cadences')
          .update({
            name: name || editingCadence.name,
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
                name: name || c.name,
                description: description?.trim() || null,
                blocks, 
                nodes: blocks, 
                updated_at: new Date().toISOString() 
              }
            : c
        ));
      } else {
        // Create new cadence in Supabase
        if (!name || !name.trim()) {
          alert('Please enter a cadence name');
          return;
        }

        const { data, error } = await supabase
          .from('cadences')
          .insert({
            user_id: user.id,
            name: name.trim(),
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
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        alert('You must be signed in to run cadences');
        return;
      }

      // Test email and phone
      const testEmail = 'sg.suriya.v@gmail.com';
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
      const response = await fetch('/api/cadence/start', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ company_cadence_id: companyCadenceId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to start cadence');
      }

      const result = await response.json();
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
      
      alert(`Cadence started!\n\nExecution ID: ${result.execution_id}\n\nCheck browser console (F12) for detailed status.\nServer logs are in the terminal running "npm run dev"`);
    } catch (error: any) {
      console.error('Error running cadence:', error);
      alert(`Error: ${error.message || 'Failed to run cadence'}`);
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

  const handleCloseFlowBuilder = useCallback((force = false) => {
    if (!force && hasUnsavedChanges) {
      const confirmed = confirm('You have unsaved changes. Are you sure you want to exit without saving?');
      if (!confirmed) {
        return;
      }
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
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">Loading cadences...</div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="border-b border-border bg-background px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-foreground">Cadences</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage your outreach sequences ({cadences.length})
            </p>
          </div>
          <Button
            onClick={handleCreateCadence}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Create Cadence
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {cadences.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-8">
            <div className="text-muted-foreground mb-4">
              No cadences yet. Create your first cadence to get started.
            </div>
          </div>
        ) : (
          <div className="w-full">
            <table className="w-full">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-8 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-8 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-8 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Updated
                  </th>
                  <th className="px-8 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Blocks
                  </th>
                  <th className="px-8 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {cadences.map((cadence) => (
                  <motion.tr
                    key={cadence.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-8 py-4 whitespace-nowrap">
                      <div className="font-medium text-foreground">{cadence.name}</div>
                    </td>
                    <td className="px-8 py-4">
                      <div className="text-sm text-muted-foreground max-w-md truncate">
                        {cadence.description || '-'}
                      </div>
                    </td>
                    <td className="px-8 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {new Date(cadence.updated_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-8 py-4 whitespace-nowrap">
                      <div className="text-sm text-foreground">
                        {cadence.blocks?.length || 0}
                      </div>
                    </td>
                    <td className="px-8 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRunCadence(cadence.id)}
                          className="h-8"
                        >
                          <Play className="h-3.5 w-3.5 mr-1.5" />
                          Run Cadence
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditCadence(cadence)}
                          className="h-8"
                        >
                          <Edit className="h-3.5 w-3.5 mr-1.5" />
                          Edit
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleDeleteCadence(cadence.id)}
                          className="h-8"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Flow Builder Modal */}
      <AnimatePresence>
        {showFlowBuilder && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            onClick={handleCloseFlowBuilder}
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
    </div>
  );
}
