"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, FileText, Plus, Play, Mail, Phone, Edit, History, Upload, DollarSign, FileUp, BarChart3, X, User, MoreVertical, Settings } from "lucide-react";
import { motion } from "framer-motion";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';

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

interface EmailLog {
  id: string;
  company_id: string;
  cadence_id?: string;
  direction: 'sent' | 'received';
  subject?: string;
  body?: string;
  from_email: string;
  to_email: string;
  thread_id?: string;
  message_id?: string;
  sent_at?: string;
  received_at?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

interface CallLog {
  id: string;
  company_id: string;
  cadence_id?: string;
  call_type: 'voice_call' | 'voicemail';
  direction?: 'outbound' | 'inbound';
  phone_number?: string;
  vapi_call_id?: string;
  transcription?: string;
  notes?: string;
  duration_seconds?: number;
  status?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

interface FinancialData {
  id: string;
  company_id: string;
  year: number;
  arr?: number;
  gross_retention?: number;
  net_retention?: number;
  gross_margin?: number;
  ebitda?: number;
  created_at: string;
  updated_at: string;
}

interface PitchDeck {
  id: string;
  company_id: string;
  file_name: string;
  file_url: string;
  file_size?: number;
  uploaded_by?: string;
  uploaded_at: string;
  version?: number;
  notes?: string;
}

interface Contact {
  id: string;
  company_id: string;
  first_name: string;
  last_name: string;
  title?: string;
  email?: string;
  phone?: string;
  created_at: string;
  updated_at: string;
}

interface Opportunity {
  id: string;
  company_id: string;
  name: string;
  stage: 'prospecting' | 'qualification' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost';
  amount?: number;
  probability?: number;
  close_date?: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export default function CompanyDetailPage() {
  const params = useParams();
  const companyId = params.id as string;
  const [company, setCompany] = useState<Company | null>(null);
  const [content, setContent] = useState<CompanyContent[]>([]);
  const [cadences, setCadences] = useState<Cadence[]>([]);
  const [companyCadences, setCompanyCadences] = useState<CompanyCadence[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddCadenceModal, setShowAddCadenceModal] = useState(false);
  const [selectedCadenceId, setSelectedCadenceId] = useState<string>('');
  const [addingToCadence, setAddingToCadence] = useState(false);
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneValue, setPhoneValue] = useState('');
  const [startingCadence, setStartingCadence] = useState<string | null>(null);
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [processingSchedule, setProcessingSchedule] = useState(false);
  
  // New state for revamped UI
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [financials, setFinancials] = useState<FinancialData[]>([]);
  const [pitchDecks, setPitchDecks] = useState<PitchDeck[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [showFinancialsModal, setShowFinancialsModal] = useState(false);
  const [editingFinancialYear, setEditingFinancialYear] = useState<number | null>(null);
  const [uploadingPitchDeck, setUploadingPitchDeck] = useState(false);
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [showAddOpportunityModal, setShowAddOpportunityModal] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [contactCadences, setContactCadences] = useState<Record<string, string>>({});
  const [autoSwitchCadences, setAutoSwitchCadences] = useState<Record<string, boolean>>({});
  
  // Financial form state
  const [financialForm, setFinancialForm] = useState({
    year: new Date().getFullYear(),
    arr: '',
    gross_retention: '',
    net_retention: '',
    gross_margin: '',
    ebitda: '',
  });

  // Contact form state
  const [contactForm, setContactForm] = useState({
    first_name: '',
    last_name: '',
    title: '',
    email: '',
    phone: '',
  });

  // Opportunity form state
  const [opportunityForm, setOpportunityForm] = useState({
    name: '',
    stage: 'prospecting' as Opportunity['stage'],
    amount: '',
    probability: '',
    close_date: '',
    description: '',
  });

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

      const [
        companyResult,
        contentResult,
        cadencesResult,
        companyCadencesResult,
        emailLogsResult,
        callLogsResult,
        financialsResult,
        pitchDecksResult,
        contactsResult,
        opportunitiesResult
      ] = await Promise.all([
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
        supabase
          .from("email_logs")
          .select("*")
          .eq("company_id", companyId)
          .order("sent_at", { ascending: false }),
        supabase
          .from("call_logs")
          .select("*")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false }),
        supabase
          .from("company_financials")
          .select("*")
          .eq("company_id", companyId)
          .order("year", { ascending: false }),
        supabase
          .from("company_pitch_decks")
          .select("*")
          .eq("company_id", companyId)
          .order("uploaded_at", { ascending: false }),
        supabase
          .from("contacts")
          .select("*")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false }),
        supabase
          .from("opportunities")
          .select("*")
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

      if (cadencesResult.data) {
        setCadences(cadencesResult.data);
      }

      if (companyCadencesResult.data) {
        setCompanyCadences(companyCadencesResult.data as any);
      }

      if (emailLogsResult.data) {
        setEmailLogs(emailLogsResult.data);
      }

      if (callLogsResult.data) {
        setCallLogs(callLogsResult.data);
      }

      if (financialsResult.data) {
        setFinancials(financialsResult.data);
      }

      if (pitchDecksResult.data) {
        setPitchDecks(pitchDecksResult.data);
      }

      if (contactsResult.data) {
        setContacts(contactsResult.data);
      }

      if (opportunitiesResult.data) {
        setOpportunities(opportunitiesResult.data);
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

  // Handlers for Financials
  const handleSaveFinancials = async () => {
    if (!companyId) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const data = {
        company_id: companyId,
        year: financialForm.year,
        arr: financialForm.arr ? parseFloat(financialForm.arr) : null,
        gross_retention: financialForm.gross_retention ? parseFloat(financialForm.gross_retention) : null,
        net_retention: financialForm.net_retention ? parseFloat(financialForm.net_retention) : null,
        gross_margin: financialForm.gross_margin ? parseFloat(financialForm.gross_margin) : null,
        ebitda: financialForm.ebitda ? parseFloat(financialForm.ebitda) : null,
      };

      const { error } = await supabase
        .from('company_financials')
        .upsert(data, { onConflict: 'company_id,year' });

      if (error) throw error;

      setShowFinancialsModal(false);
      setEditingFinancialYear(null);
      setFinancialForm({
        year: new Date().getFullYear(),
        arr: '',
        gross_retention: '',
        net_retention: '',
        gross_margin: '',
        ebitda: '',
      });
      await fetchCompany();
    } catch (error: any) {
      alert(`Error saving financials: ${error.message}`);
    }
  };

  const handleEditFinancials = (year: number) => {
    const financial = financials.find(f => f.year === year);
    if (financial) {
      setFinancialForm({
        year: financial.year,
        arr: financial.arr?.toString() || '',
        gross_retention: financial.gross_retention?.toString() || '',
        net_retention: financial.net_retention?.toString() || '',
        gross_margin: financial.gross_margin?.toString() || '',
        ebitda: financial.ebitda?.toString() || '',
      });
      setEditingFinancialYear(year);
      setShowFinancialsModal(true);
    }
  };

  // Handlers for Contacts
  const handleSaveContact = async () => {
    if (!companyId) return;
    try {
      const { error } = await supabase
        .from('contacts')
        .insert({
          company_id: companyId,
          ...contactForm,
        });

      if (error) throw error;

      setShowAddContactModal(false);
      setContactForm({
        first_name: '',
        last_name: '',
        title: '',
        email: '',
        phone: '',
      });
      await fetchCompany();
    } catch (error: any) {
      alert(`Error saving contact: ${error.message}`);
    }
  };

  // Handlers for Opportunities
  const handleSaveOpportunity = async () => {
    if (!companyId) return;
    try {
      const { error } = await supabase
        .from('opportunities')
        .insert({
          company_id: companyId,
          name: opportunityForm.name,
          stage: opportunityForm.stage,
          amount: opportunityForm.amount ? parseFloat(opportunityForm.amount) : null,
          probability: opportunityForm.probability ? parseInt(opportunityForm.probability) : null,
          close_date: opportunityForm.close_date || null,
          description: opportunityForm.description || null,
        });

      if (error) throw error;

      setShowAddOpportunityModal(false);
      setOpportunityForm({
        name: '',
        stage: 'prospecting',
        amount: '',
        probability: '',
        close_date: '',
        description: '',
      });
      await fetchCompany();
    } catch (error: any) {
      alert(`Error saving opportunity: ${error.message}`);
    }
  };

  // Handler for editing company fields
  const handleSaveField = async (field: string) => {
    if (!companyId) return;
    try {
      const updateData: any = {};
      updateData[field] = editingValue || null;

      const { error } = await supabase
        .from('companies')
        .update(updateData)
        .eq('id', companyId);

      if (error) throw error;

      setEditingField(null);
      setEditingValue('');
      await fetchCompany();
    } catch (error: any) {
      alert(`Error saving ${field}: ${error.message}`);
    }
  };

  // Handler for Pitch Deck Upload
  const handlePitchDeckUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !companyId) return;

    if (file.type !== 'application/pdf') {
      alert('Please upload a PDF file');
      return;
    }

    try {
      setUploadingPitchDeck(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Upload to Supabase Storage (you'll need to set up a bucket)
      const fileName = `${companyId}/${Date.now()}_${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('pitch-decks')
        .upload(fileName, file, { contentType: 'application/pdf' });

      if (uploadError) {
        // If storage bucket doesn't exist, use public URL placeholder
        console.warn('Storage upload failed, using placeholder:', uploadError);
        const { error } = await supabase
          .from('company_pitch_decks')
          .insert({
            company_id: companyId,
            file_name: file.name,
            file_url: URL.createObjectURL(file), // Temporary URL
            file_size: file.size,
            uploaded_by: user.id,
          });

        if (error) throw error;
      } else {
        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('pitch-decks')
          .getPublicUrl(fileName);

        const { error } = await supabase
          .from('company_pitch_decks')
          .insert({
            company_id: companyId,
            file_name: file.name,
            file_url: publicUrl,
            file_size: file.size,
            uploaded_by: user.id,
          });

        if (error) throw error;
      }

      await fetchCompany();
      alert('Pitch deck uploaded successfully!');
    } catch (error: any) {
      alert(`Error uploading pitch deck: ${error.message}`);
    } finally {
      setUploadingPitchDeck(false);
      e.target.value = ''; // Reset input
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
    <div className="flex h-full flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <Link href="/companies">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Companies
          </Button>
        </Link>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white text-2xl font-bold">
              {company.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{company.name}</h1>
              <p className="text-sm text-gray-600 mt-1">{company.website || 'No website'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content - Card Layout */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-6">
              {/* People/Contacts Section */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <User className="h-4 w-4" />
                    People ({contacts.length})
                  </h2>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowAddContactModal(true)}
                    className="text-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add
                  </Button>
                </div>
                {contacts.length === 0 ? (
                  <p className="text-xs text-gray-500">No contacts yet</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {contacts.slice(0, 5).map((contact) => (
                      <div
                        key={contact.id}
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-full text-sm text-gray-900 cursor-pointer transition-colors"
                      >
                        <span>{contact.first_name} {contact.last_name}</span>
                      </div>
                    ))}
                    {contacts.length > 5 && (
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-full text-sm text-gray-600">
                        +{contacts.length - 5}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Add to Cadence per Person Section */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-gray-900">Cadence per Person</h2>
                  <label className="flex items-center gap-2 text-xs text-gray-600">
                    <input
                      type="checkbox"
                      checked={Object.values(autoSwitchCadences).some(v => v)}
                      onChange={(e) => {
                        const newValue = e.target.checked;
                        const newAutoSwitch: Record<string, boolean> = {};
                        contacts.forEach(c => {
                          newAutoSwitch[c.id] = newValue;
                        });
                        setAutoSwitchCadences(newAutoSwitch);
                      }}
                      className="rounded"
                    />
                    Auto-switch if no response
                  </label>
                </div>
                <div className="space-y-3">
                  {contacts.length === 0 ? (
                    <p className="text-xs text-gray-500">Add contacts to assign cadences</p>
                  ) : (
                    contacts.map((contact) => (
                      <div key={contact.id} className="flex items-center justify-between p-2 border border-gray-200 rounded">
                        <div className="flex-1">
                          <span className="text-sm text-gray-900">{contact.first_name} {contact.last_name}</span>
                          {contact.title && (
                            <span className="text-xs text-gray-500 ml-2">({contact.title})</span>
                          )}
                        </div>
                        <select
                          value={contactCadences[contact.id] || ''}
                          onChange={(e) => setContactCadences({ ...contactCadences, [contact.id]: e.target.value })}
                          className="text-xs border border-gray-300 rounded px-2 py-1"
                        >
                          <option value="">Select cadence...</option>
                          {cadences.map((cadence) => (
                            <option key={cadence.id} value={cadence.id}>
                              {cadence.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Financials Section */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-gray-900">Financials</h2>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setFinancialForm({
                        year: new Date().getFullYear(),
                        arr: '',
                        gross_retention: '',
                        net_retention: '',
                        gross_margin: '',
                        ebitda: '',
                      });
                      setEditingFinancialYear(null);
                      setShowFinancialsModal(true);
                    }}
                    className="text-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add
                  </Button>
                </div>
                {financials.length > 0 ? (
                  <div className="space-y-2">
                    {financials.sort((a, b) => b.year - a.year).slice(0, 3).map((f) => (
                      <div key={f.id} className="text-sm">
                        <div className="font-medium text-gray-900">{f.year}</div>
                        {f.arr && (
                          <div className="text-xs text-gray-600 mt-1">
                            ARR: ${(f.arr / 1000000).toFixed(2)}M
                          </div>
                        )}
                        {f.gross_retention && (
                          <div className="text-xs text-gray-600">
                            Gross Retention: {f.gross_retention}%
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">No financial data</p>
                )}
              </div>
            </div>

            {/* Right Column - Activity Feed / Log History */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Activity Feed</h2>
              {/* Activity Input Bar */}
              <div className="flex items-center gap-2 border-b border-gray-200 pb-4 mb-4">
                <Button variant="ghost" size="sm">
                  <Mail className="h-4 w-4 mr-2" />
                  Email
                </Button>
                <Button variant="ghost" size="sm">
                  <Phone className="h-4 w-4 mr-2" />
                  Log a Call
                </Button>
                <Button variant="ghost" size="sm">
                  <Calendar className="h-4 w-4 mr-2" />
                  New Event
                </Button>
              </div>

              {/* Log History */}
              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {/* Email Logs */}
                {emailLogs.length > 0 && (
                <div>
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                      Emails ({emailLogs.length})
                    </h3>
                    <div className="space-y-2">
                      {emailLogs.map((log) => (
                        <div
                          key={log.id}
                          className="rounded-lg border border-gray-200 bg-gray-50 p-4 hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                log.direction === 'sent' 
                                  ? 'bg-blue-100 text-blue-800' 
                                  : 'bg-green-100 text-green-800'
                              }`}>
                                {log.direction === 'sent' ? 'Sent' : 'Received'}
                              </span>
                              {log.subject && (
                                <span className="text-sm font-medium text-gray-900">
                                  {log.subject}
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-gray-500">
                              {new Date(log.sent_at || log.received_at || log.created_at).toLocaleString()}
                            </span>
                          </div>
                          <div className="text-xs text-gray-600 mb-2">
                            {log.direction === 'sent' ? 'From' : 'To'}: {log.from_email} → {log.to_email}
                          </div>
                          {log.body && (
                            <p className="text-sm text-gray-700 line-clamp-3">
                              {log.body.replace(/<[^>]*>/g, '').substring(0, 200)}
                              {log.body.length > 200 ? '...' : ''}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Call Logs */}
                {callLogs.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      Calls ({callLogs.length})
                    </h3>
                    <div className="space-y-2">
                      {callLogs.map((call) => (
                        <div
                          key={call.id}
                          className="rounded-lg border border-gray-200 bg-gray-50 p-4 hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                call.call_type === 'voice_call' 
                                  ? 'bg-purple-100 text-purple-800' 
                                  : 'bg-orange-100 text-orange-800'
                              }`}>
                                {call.call_type === 'voice_call' ? 'Voice Call' : 'Voicemail'}
                              </span>
                              {call.phone_number && (
                                <span className="text-xs text-gray-600">
                                  {call.phone_number}
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-gray-500">
                              {new Date(call.created_at).toLocaleString()}
                            </span>
                          </div>
                          {call.transcription && (
                            <p className="text-sm text-gray-700 mb-2 line-clamp-3">
                              {call.transcription}
                            </p>
                          )}
                          {call.notes && (
                            <div className="mt-2 p-2 bg-blue-50 rounded text-xs">
                              <span className="font-medium">Notes: </span>
                              {call.notes}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {emailLogs.length === 0 && callLogs.length === 0 && (
                  <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-lg">
                    <History className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p className="text-sm text-gray-500 mb-2">
                      No activities to show. Get started by sending an email, scheduling a task, and more.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
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

      {/* Add Contact Modal */}
      {showAddContactModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowAddContactModal(false);
            }
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white border border-gray-200 rounded-lg p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4">Add Contact</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">First Name</label>
                <input
                  type="text"
                  value={contactForm.first_name}
                  onChange={(e) => setContactForm({ ...contactForm, first_name: e.target.value })}
                  className="w-full p-2 border rounded"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Last Name</label>
                <input
                  type="text"
                  value={contactForm.last_name}
                  onChange={(e) => setContactForm({ ...contactForm, last_name: e.target.value })}
                  className="w-full p-2 border rounded"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Title</label>
                <input
                  type="text"
                  value={contactForm.title}
                  onChange={(e) => setContactForm({ ...contactForm, title: e.target.value })}
                  className="w-full p-2 border rounded"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Email</label>
                      <input
                        type="email"
                  value={contactForm.email}
                  onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                  className="w-full p-2 border rounded"
                />
                    </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Phone</label>
                <input
                  type="tel"
                  value={contactForm.phone}
                  onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                  className="w-full p-2 border rounded"
                />
              </div>
              <div className="flex gap-2 justify-end pt-4">
                <Button variant="outline" onClick={() => setShowAddContactModal(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveContact} disabled={!contactForm.first_name || !contactForm.last_name}>
                  Save Contact
                      </Button>
              </div>
            </div>
          </motion.div>
                    </div>
                  )}

      {/* Add Opportunity Modal */}
      {showAddOpportunityModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowAddOpportunityModal(false);
            }
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white border border-gray-200 rounded-lg p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4">Add Opportunity</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Opportunity Name</label>
                <input
                  type="text"
                  value={opportunityForm.name}
                  onChange={(e) => setOpportunityForm({ ...opportunityForm, name: e.target.value })}
                  className="w-full p-2 border rounded"
                />
                </div>
                <div>
                <label className="text-sm font-medium mb-1 block">Stage</label>
                <select
                  value={opportunityForm.stage}
                  onChange={(e) => setOpportunityForm({ ...opportunityForm, stage: e.target.value as Opportunity['stage'] })}
                  className="w-full p-2 border rounded"
                >
                  <option value="prospecting">Prospecting</option>
                  <option value="qualification">Qualification</option>
                  <option value="proposal">Proposal</option>
                  <option value="negotiation">Negotiation</option>
                  <option value="closed_won">Closed Won</option>
                  <option value="closed_lost">Closed Lost</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Amount ($)</label>
                <input
                  type="number"
                  value={opportunityForm.amount}
                  onChange={(e) => setOpportunityForm({ ...opportunityForm, amount: e.target.value })}
                  className="w-full p-2 border rounded"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Probability (%)</label>
                <input
                  type="number"
                  value={opportunityForm.probability}
                  onChange={(e) => setOpportunityForm({ ...opportunityForm, probability: e.target.value })}
                  className="w-full p-2 border rounded"
                  min="0"
                  max="100"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Close Date</label>
                <input
                  type="date"
                  value={opportunityForm.close_date}
                  onChange={(e) => setOpportunityForm({ ...opportunityForm, close_date: e.target.value })}
                  className="w-full p-2 border rounded"
                />
              </div>
              <div className="flex gap-2 justify-end pt-4">
                <Button variant="outline" onClick={() => setShowAddOpportunityModal(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveOpportunity} disabled={!opportunityForm.name}>
                  Save Opportunity
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Financials Modal */}
      {showFinancialsModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowFinancialsModal(false);
              setEditingFinancialYear(null);
            }
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-background border border-border rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                {editingFinancialYear ? `Edit ${editingFinancialYear} Financials` : 'Add Financial Data'}
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowFinancialsModal(false);
                  setEditingFinancialYear(null);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Year</label>
                <select
                  value={financialForm.year}
                  onChange={(e) => setFinancialForm({ ...financialForm, year: parseInt(e.target.value) })}
                  className="w-full p-2 border rounded bg-white text-gray-900"
                  disabled={!!editingFinancialYear}
                >
                  <option value={2023}>2023</option>
                  <option value={2024}>2024</option>
                  <option value={2025}>2025</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">ARR ($)</label>
                <input
                  type="number"
                  value={financialForm.arr}
                  onChange={(e) => setFinancialForm({ ...financialForm, arr: e.target.value })}
                  placeholder="e.g., 10000000"
                  className="w-full p-2 border rounded bg-white text-gray-900"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Gross Retention (%)</label>
                  <input
                    type="number"
                    value={financialForm.gross_retention}
                    onChange={(e) => setFinancialForm({ ...financialForm, gross_retention: e.target.value })}
                    placeholder="e.g., 95"
                    className="w-full p-2 border rounded bg-white text-gray-900"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Net Retention (%)</label>
                  <input
                    type="number"
                    value={financialForm.net_retention}
                    onChange={(e) => setFinancialForm({ ...financialForm, net_retention: e.target.value })}
                    placeholder="e.g., 120"
                    className="w-full p-2 border rounded bg-white text-gray-900"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Gross Margin (%)</label>
                  <input
                    type="number"
                    value={financialForm.gross_margin}
                    onChange={(e) => setFinancialForm({ ...financialForm, gross_margin: e.target.value })}
                    placeholder="e.g., 75"
                    className="w-full p-2 border rounded bg-white text-gray-900"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">EBITDA (%)</label>
                  <input
                    type="number"
                    value={financialForm.ebitda}
                    onChange={(e) => setFinancialForm({ ...financialForm, ebitda: e.target.value })}
                    placeholder="e.g., 10"
                    className="w-full p-2 border rounded bg-white text-gray-900"
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowFinancialsModal(false);
                    setEditingFinancialYear(null);
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={handleSaveFinancials}>
                  Save Financials
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
