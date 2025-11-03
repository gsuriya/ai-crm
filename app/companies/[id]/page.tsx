"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { signInWithGoogleDirect } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, FileText, Tag, Plus, Play, Mail, Phone, Edit } from "lucide-react";
import { motion } from "framer-motion";
import { MatchIndicator } from "@/components/match-indicator";
import { MatchSnippet } from "@/components/match-snippet";

export const dynamic = 'force-dynamic';

interface Company {
  id: string;
  name: string;
  email?: string;
  phone_number?: string;
  created_at: string;
  updated_at: string;
  arr?: number;
  funding_amount?: number;
}

interface CompanyContent {
  id: string;
  company_id: string;
  content_type: string;
  content: string;
  source?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

interface CompanyCadence {
  id: string;
  cadence_id: string;
  status: string;
  start_date: string;
  completed_at?: string;
  cadence?: {
    id: string;
    name: string;
    description?: string;
  };
}

interface CompanyMetadata {
  id: string;
  company_id: string;
  key: string;
  value: string;
  created_at: string;
}

interface Cadence {
  id: string;
  name: string;
  description?: string;
  user_id?: string;
}

export default function CompanyDetailPage() {
  const params = useParams();
  const companyId = params.id as string;
  const [company, setCompany] = useState<Company | null>(null);
  const [content, setContent] = useState<CompanyContent[]>([]);
  const [metadata, setMetadata] = useState<CompanyMetadata[]>([]);
  const [cadences, setCadences] = useState<Cadence[]>([]);
  const [companyCadences, setCompanyCadences] = useState<CompanyCadence[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddCadenceModal, setShowAddCadenceModal] = useState(false);
  const [selectedCadenceId, setSelectedCadenceId] = useState<string>('');
  const [addingToCadence, setAddingToCadence] = useState(false);
  const [editingEmail, setEditingEmail] = useState(false);
  const [editingPhone, setEditingPhone] = useState(false);
  const [emailValue, setEmailValue] = useState('');
  const [phoneValue, setPhoneValue] = useState('');
  const [startingCadence, setStartingCadence] = useState<string | null>(null);
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [processingSchedule, setProcessingSchedule] = useState(false);

  const handleSendTestEmail = async () => {
    try {
      setSendingTestEmail(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('Not authenticated');
        return;
      }

      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: 'sg.suriya.v@gmail.com',
          subject: 'Test Email',
          body: 'This is a test email from the CRM.',
        }),
      });

      const data = await response.json();
      if (response.ok) {
        alert(`✅ Email sent successfully!\n\nMessage ID: ${data.messageId}\nThread ID: ${data.threadId}`);
      } else {
        alert(`❌ Error: ${data.error || 'Failed to send email'}`);
      }
    } catch (error: any) {
      alert(`❌ Error: ${error.message || 'Failed to send email'}`);
    } finally {
      setSendingTestEmail(false);
    }
  };

  // Lightweight refresh - just updates cadences without showing loading screen
  const refreshCadences = useCallback(async () => {
    if (!companyId) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: companyCadencesResult } = await supabase
        .from("company_cadences")
        .select(`
          *,
          cadence:cadences(*)
        `)
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });

      if (companyCadencesResult) {
        setCompanyCadences(companyCadencesResult as any);
      }
    } catch (error) {
      console.error("Error refreshing cadences:", error);
    }
  }, [companyId]);

  const fetchCompany = useCallback(async () => {
    if (!companyId) return;
    
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [companyResult, contentResult, metadataResult, cadencesResult, companyCadencesResult] = await Promise.all([
        supabase
          .from("companies")
          .select("*")
          .eq("id", companyId)
          .single(),
        supabase
          .from("company_content")
          .select("*")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false }),
        supabase
          .from("company_metadata")
          .select("*")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false }),
        supabase
          .from("cadences")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("company_cadences")
          .select(`
            *,
            cadence:cadences(*)
          `)
          .eq("company_id", companyId)
          .order("created_at", { ascending: false }),
      ]);

      if (companyResult.error) throw companyResult.error;
      setCompany(companyResult.data);
      setEmailValue(companyResult.data?.email || '');
      setPhoneValue(companyResult.data?.phone_number || '');

      if (contentResult.data) {
        setContent(contentResult.data);
      }

      if (metadataResult.data) {
        setMetadata(metadataResult.data);
      }

      if (cadencesResult.data) {
        setCadences(cadencesResult.data);
      }

      if (companyCadencesResult.data) {
        setCompanyCadences(companyCadencesResult.data as any);
      }
    } catch (error) {
      console.error("Error fetching company:", error);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  const handleAddToCadence = async () => {
    if (!selectedCadenceId || !companyId) return;

    try {
      setAddingToCadence(true);
      
      // Debug: Check if we have a session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('No session found. Please sign in again.');
        return;
      }
      
      console.log('Session found, user:', session.user.email);
      
      const response = await fetch('/api/cadence/execute', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies for auth
        body: JSON.stringify({
          company_id: companyId,
          cadence_id: selectedCadenceId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('API Error:', error);
        throw new Error(error.error || 'Failed to add company to cadence');
      }

      // Refresh company cadences
      await fetchCompany();
      setShowAddCadenceModal(false);
      setSelectedCadenceId('');
      alert('Company added to cadence! Click "Start Cadence" to run it.');
    } catch (error: any) {
      console.error('Error adding to cadence:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setAddingToCadence(false);
    }
  };

  const handleStartCadence = async (companyCadenceId: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    try {
      setStartingCadence(companyCadenceId);
      const response = await fetch('/api/cadence/start', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Include cookies for auth
        body: JSON.stringify({ company_cadence_id: companyCadenceId }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('API Error:', error);
        
        // Check if it's a scope error (check both error.error and error.isScopeError flag)
        const isScopeError = error.isScopeError || 
                            error.error?.includes('insufficient authentication scopes') || 
                            error.error?.includes('missing required scope') ||
                            error.error?.includes('OAuth token missing required scope') ||
                            error.error?.includes('Token missing required scope') ||
                            error.error?.includes('gmail.send') ||
                            response.status === 403;
        
        if (isScopeError) {
          // Show detailed error message
          const errorMessage = error.error || 'Missing required Google permissions';
          // Show alert - DON'T auto-sign out (user needs to revoke access first)
          alert(
            `❌ Google OAuth Token Missing Required Permissions\n\n` +
            `Error: ${errorMessage}\n\n` +
            `🔴 CRITICAL: Your refresh token was created WITHOUT scopes.\n` +
            `Even though you see scopes in auth-status, when the API refreshes your token,\n` +
            `Google returns a token without scopes because the refresh token doesn't have them.\n\n` +
            `To fix this, you MUST:\n` +
            `1. Go to: https://myaccount.google.com/permissions\n` +
            `2. Find and REVOKE this app's access (this ensures fresh refresh token)\n` +
            `3. Click "Sign Out" in the sidebar\n` +
            `4. Sign back in with Google\n` +
            `5. On the consent screen, GRANT ALL permissions\n` +
            `6. Look for "Send email on your behalf" permission specifically\n` +
            `7. After signing back in, try clicking Restart again\n\n` +
            `⚠️ IMPORTANT: Revoking access FIRST ensures you get a fresh refresh token WITH scopes!`
          );
          
          // Don't throw error - just show the alert
          return;
        }
        
        throw new Error(error.error || 'Failed to start cadence');
      }

      const result = await response.json();
      
      if (!result.success) {
        alert(`Error: ${result.error || 'Failed to start cadence'}`);
        return;
      }
      
      // Refresh cadences without showing loading screen
      await refreshCadences();
      // Don't show alert - just update silently
      console.log(result.message || 'Cadence started successfully!');
    } catch (error: any) {
      console.error('Error starting cadence:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setStartingCadence(null);
    }
  };

  const handleSaveEmail = async () => {
    if (!companyId) return;
    try {
      const { error } = await supabase
        .from('companies')
        .update({ email: emailValue || null })
        .eq('id', companyId);

      if (error) throw error;
      setEditingEmail(false);
      await fetchCompany();
    } catch (error: any) {
      alert(`Error saving email: ${error.message}`);
    }
  };

  const handleSavePhone = async () => {
    if (!companyId) return;
    try {
      const { error } = await supabase
        .from('companies')
        .update({ phone_number: phoneValue || null })
        .eq('id', companyId);

      if (error) throw error;
      setEditingPhone(false);
      await fetchCompany();
    } catch (error: any) {
      alert(`Error saving phone: ${error.message}`);
    }
  };

  const handleProcessSchedule = useCallback(async (silent = true) => {
    try {
      setProcessingSchedule(true);
      const response = await fetch('/api/cadence/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();
      if (response.ok) {
        if (data.processed > 0) {
          console.log(`✅ Processed ${data.processed} scheduled execution(s)`);
          if (!silent) {
            alert(`✅ Processed ${data.processed} scheduled execution(s)\n${data.errors > 0 ? `⚠️ ${data.errors} error(s)` : ''}`);
          }
          // Refresh company data to show updated status
          fetchCompany();
        }
      } else {
        if (!silent) {
          alert(`❌ Error: ${data.error || 'Failed to process schedule'}`);
        }
      }
    } catch (error: any) {
      if (!silent) {
        alert(`❌ Error: ${error.message || 'Failed to process schedule'}`);
      }
    } finally {
      setProcessingSchedule(false);
    }
  }, [fetchCompany]);

  // Automatically process scheduled executions
  useEffect(() => {
    fetchCompany();
    
    // Process scheduled executions on page load
    handleProcessSchedule();
    
    // Set up interval to check for scheduled executions every 10 seconds
    const interval = setInterval(() => {
      handleProcessSchedule();
    }, 10000); // Check every 10 seconds
    
    return () => clearInterval(interval);
  }, [fetchCompany, handleProcessSchedule]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">Loading company details...</div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <div className="text-muted-foreground">Company not found</div>
        <Link href="/companies">
          <Button variant="outline" className="mt-4">
            Back to Companies
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border bg-background px-8 py-6">
        <Link href="/companies">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Companies
          </Button>
        </Link>
        <h1 className="text-3xl font-semibold text-foreground">{company.name}</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Company Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Company Name
                  </label>
                  <p className="mt-1 text-sm text-foreground">{company.name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email
                  </label>
                  {editingEmail ? (
                    <div className="mt-1 flex gap-2">
                      <input
                        type="email"
                        value={emailValue}
                        onChange={(e) => setEmailValue(e.target.value)}
                        className="flex-1 px-2 py-1 border rounded text-sm"
                        placeholder="company@example.com"
                      />
                      <Button size="sm" onClick={handleSaveEmail}>Save</Button>
                      <Button size="sm" variant="outline" onClick={() => {
                        setEditingEmail(false);
                        setEmailValue(company.email || '');
                      }}>Cancel</Button>
                    </div>
                  ) : (
                    <div className="mt-1 flex items-center gap-2">
                      <p className="text-sm text-foreground">{company.email || 'No email set'}</p>
                      <Button size="sm" variant="ghost" onClick={() => {
                        setEditingEmail(true);
                        setEmailValue(company.email || '');
                      }}>
                        <Edit className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Phone Number
                  </label>
                  {editingPhone ? (
                    <div className="mt-1 flex gap-2">
                      <input
                        type="tel"
                        value={phoneValue}
                        onChange={(e) => setPhoneValue(e.target.value)}
                        className="flex-1 px-2 py-1 border rounded text-sm"
                        placeholder="+1234567890"
                      />
                      <Button size="sm" onClick={handleSavePhone}>Save</Button>
                      <Button size="sm" variant="outline" onClick={() => {
                        setEditingPhone(false);
                        setPhoneValue(company.phone_number || '');
                      }}>Cancel</Button>
                    </div>
                  ) : (
                    <div className="mt-1 flex items-center gap-2">
                      <p className="text-sm text-foreground">{company.phone_number || 'No phone number set'}</p>
                      <Button size="sm" variant="ghost" onClick={() => {
                        setEditingPhone(true);
                        setPhoneValue(company.phone_number || '');
                      }}>
                        <Edit className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Created At
                  </label>
                  <p className="mt-1 text-sm text-foreground">
                    {new Date(company.created_at).toLocaleString()}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Last Updated
                  </label>
                  <p className="mt-1 text-sm text-foreground">
                    {new Date(company.updated_at).toLocaleString()}
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Email Thread</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Email thread functionality coming soon...
                </p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Cadences Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Play className="h-5 w-5" />
                    Active Cadences ({companyCadences.length})
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setShowAddCadenceModal(true)}
                      size="sm"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add to Cadence
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {companyCadences.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No active cadences for this company.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {companyCadences.map((cc) => (
                      <div
                        key={cc.id}
                        className="flex items-center justify-between rounded-lg border border-border bg-accent/20 p-3"
                      >
                        <div className="flex-1">
                          <div className="text-sm font-medium text-foreground">
                            {(cc.cadence as any)?.name || 'Unknown Cadence'}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Status: {cc.status} • Started: {new Date(cc.start_date).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {cc.status === 'paused' && (
                              <Button
                                size="sm"
                                onClick={(e) => handleStartCadence(cc.id, e)}
                                disabled={startingCadence === cc.id}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <Play className="h-3 w-3 mr-1" />
                                {startingCadence === cc.id ? 'Starting...' : 'Start Cadence'}
                              </Button>
                          )}
                          {cc.status !== 'completed' && cc.status !== 'paused' && (
                            <>
                              <Button
                                size="sm"
                                onClick={(e) => handleStartCadence(cc.id, e)}
                                disabled={startingCadence === cc.id}
                                variant="outline"
                                className="border-green-600 text-green-600 hover:bg-green-50"
                              >
                                <Play className="h-3 w-3 mr-1" />
                                {startingCadence === cc.id ? 'Restarting...' : 'Restart'}
                              </Button>
                              <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                                Active
                              </span>
                            </>
                          )}
                          {cc.status === 'completed' && (
                            <>
                              <Button
                                size="sm"
                                onClick={(e) => handleStartCadence(cc.id, e)}
                                disabled={startingCadence === cc.id}
                                variant="outline"
                                className="border-green-600 text-green-600 hover:bg-green-50"
                              >
                                <Play className="h-3 w-3 mr-1" />
                                {startingCadence === cc.id ? 'Restarting...' : 'Restart'}
                              </Button>
                              <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs">
                                Completed
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Add Cadence Modal */}
          {showAddCadenceModal && (
            <div 
              className="fixed inset-0 bg-black/50 flex items-center justify-center" 
              style={{ zIndex: 40 }}
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setShowAddCadenceModal(false);
                  setSelectedCadenceId('');
                }
              }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-background border border-border rounded-lg p-6 max-w-md w-full mx-4"
                style={{ zIndex: 41 }}
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-lg font-semibold mb-4">Add Company to Cadence</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Select Cadence</label>
                    <select
                      value={selectedCadenceId}
                      onChange={(e) => setSelectedCadenceId(e.target.value)}
                      className="w-full p-2 border rounded bg-white text-gray-900"
                    >
                      <option value="">Select a cadence...</option>
                      {cadences.map((cadence) => (
                        <option key={cadence.id} value={cadence.id}>
                          {cadence.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowAddCadenceModal(false);
                        setSelectedCadenceId('');
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleAddToCadence}
                      disabled={!selectedCadenceId || addingToCadence}
                    >
                      {addingToCadence ? 'Adding...' : 'Add to Cadence'}
                    </Button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {/* Meeting Logs & Content */}
          {content.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Meeting Logs & Content ({content.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {content.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-lg border border-border bg-accent/20 p-4"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <MatchIndicator
                            contentType={item.content_type}
                            source={item.source}
                          />
                          {item.metadata?.title && (
                            <span className="text-sm font-medium text-foreground">
                              {item.metadata.title}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(item.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-foreground whitespace-pre-wrap">
                        {item.content}
                      </p>
                      {item.source && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Source: {item.source}
                        </p>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Metadata */}
          {metadata.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Tag className="h-5 w-5" />
                    Company Metadata ({metadata.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {metadata.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-lg border border-border bg-accent/20 p-4"
                      >
                        <div className="text-sm font-medium text-muted-foreground uppercase">
                          {item.key}
                        </div>
                        <div className="mt-1 text-sm font-semibold text-foreground">
                          {item.value}
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">
                          Added {new Date(item.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Notes Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Add custom notes about this company...
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

