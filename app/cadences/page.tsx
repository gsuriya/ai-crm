"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Edit, Trash2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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

  const fetchCadences = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('cadences')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;

      // Convert nodes JSONB to blocks
      const cadencesWithBlocks = (data || []).map(cadence => ({
        ...cadence,
        blocks: cadence.nodes || [],
      }));

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
    setShowFlowBuilder(true);
  };

  const handleEditCadence = (cadence: Cadence) => {
    setEditingCadence(cadence);
    setShowFlowBuilder(true);
  };

  const handleSaveFlow = async (blocks: FlowBlock[], name?: string, description?: string) => {
    try {
      if (editingCadence) {
        // Update existing cadence in Supabase
        const { error } = await supabase
          .from('cadences')
          .update({
            name: name || editingCadence.name,
            description: description || editingCadence.description,
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
                description: description || c.description,
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
            name: name.trim(),
            description: description || null,
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
      
      setShowFlowBuilder(false);
      setEditingCadence(null);
    } catch (error) {
      console.error('Error saving cadence:', error);
      alert('Failed to save cadence. Please try again.');
    }
  };

  const handleDeleteCadence = async (cadenceId: string) => {
    if (!confirm('Are you sure you want to delete this cadence?')) {
      return;
    }

    try {
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

  const handleCloseFlowBuilder = () => {
    setShowFlowBuilder(false);
    setEditingCadence(null);
  };

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

      <div className="flex-1 overflow-y-auto p-8">
        {cadences.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="text-muted-foreground mb-4">
              No cadences yet. Create your first cadence to get started.
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-6xl space-y-4">
            {cadences.map((cadence) => (
              <motion.div
                key={cadence.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-xl">{cadence.name}</CardTitle>
                        {cadence.description && (
                          <p className="mt-1 text-sm text-muted-foreground">
                            {cadence.description}
                          </p>
                        )}
                        <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Updated {new Date(cadence.updated_at).toLocaleDateString()}
                          </div>
                          {cadence.blocks && (
                            <div>{cadence.blocks.length} blocks</div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditCadence(cadence)}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleDeleteCadence(cadence.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              </motion.div>
            ))}
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
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
