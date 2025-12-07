"use client";

import { useState, useEffect } from "react";
import { X, Send, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface AddToCadenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AddToCadenceModal({ isOpen, onClose, onSuccess }: AddToCadenceModalProps) {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [company, setCompany] = useState("");
  const [cadences, setCadences] = useState<any[]>([]);
  const [selectedCadenceId, setSelectedCadenceId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchCadences();
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedCadenceId && cadences.length > 0) {
      loadEmailPreview();
    }
  }, [selectedCadenceId, firstName, lastName, company, cadences]);

  const fetchCadences = async () => {
    try {
      const { data, error } = await supabase
        .from("cadences")
        .select("id, name, nodes")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCadences(data || []);
      if (data && data.length > 0) {
        setSelectedCadenceId(data[0].id);
      }
    } catch (error) {
      console.error("Error fetching cadences:", error);
    }
  };

  const loadEmailPreview = () => {
    const cadence = cadences.find((c) => c.id === selectedCadenceId);
    if (!cadence || !cadence.nodes) {
      setSubject("");
      setBody("");
      return;
    }

    // Find start node
    const startNode = cadence.nodes.find((n: any) => n.type === "start");
    if (!startNode) {
      setSubject("");
      setBody("");
      return;
    }

    // Find first connection from start
    const connections = cadence.nodes.flatMap((n: any) => n.connections || []);
    const firstConnection = connections.find((c: any) => c.source === startNode.id);

    if (!firstConnection) {
      setSubject("");
      setBody("");
      return;
    }

    // Find the first email node
    const firstEmailNode = cadence.nodes.find(
      (n: any) => n.id === firstConnection.target && n.type === "email"
    );

    if (firstEmailNode && firstEmailNode.config) {
      const rawSubject = firstEmailNode.config.subject || "";
      const rawBody = firstEmailNode.config.body || "";
      
      setSubject(replaceVariables(rawSubject));
      setBody(replaceVariables(rawBody));
    } else {
      setSubject("");
      setBody("");
    }
  };

  const replaceVariables = (text: string) => {
    if (!text) return "";
    
    return text
      .replace(/\{\{name\}\}/g, firstName && lastName ? `${firstName} ${lastName}` : "{{name}}")
      .replace(/\{\{first_name\}\}/g, firstName || "{{first_name}}")
      .replace(/\{\{last_name\}\}/g, lastName || "{{last_name}}")
      .replace(/\{\{company\}\}/g, company || "{{company}}");
  };

  const handleSend = async () => {
    if (!email || !firstName || !lastName || !company || !selectedCadenceId) {
      alert("Please fill in all fields");
      return;
    }

    setSending(true);
    try {
      const response = await fetch("/api/people/add-to-cadence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          firstName,
          lastName,
          company,
          cadenceId: selectedCadenceId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to add to cadence");
      }

      alert(`✅ Success! ${firstName} ${lastName} has been added to the cadence!`);
      
      setEmail("");
      setFirstName("");
      setLastName("");
      setCompany("");
      setSubject("");
      setBody("");
      
      onSuccess?.();
      onClose();
    } catch (error: any) {
      console.error("Error adding to cadence:", error);
      alert(`❌ Error: ${error.message}`);
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center animate-in fade-in duration-200"
      style={{
        background: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)'
      }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-2xl w-[700px] max-w-[90vw] max-h-[90vh] flex flex-col animate-in slide-in-from-bottom-4 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          background: '#404040',
          color: 'white',
          padding: '12px 16px',
          borderRadius: '8px 8px 0 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ fontSize: '14px', fontWeight: 500 }}>New Message</div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'white',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '4px 8px',
              opacity: 0.8
            }}
            onMouseOver={(e) => e.currentTarget.style.opacity = '1'}
            onMouseOut={(e) => e.currentTarget.style.opacity = '0.8'}
          >
            ×
          </button>
        </div>

        {/* Form */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {/* Cadence Selector */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#5f6368', marginBottom: '6px', fontWeight: 500 }}>
              Select Cadence
            </label>
            <select
              value={selectedCadenceId}
              onChange={(e) => setSelectedCadenceId(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #dadce0',
                borderRadius: '4px',
                fontSize: '14px',
                fontFamily: 'Google Sans, Roboto, Arial, sans-serif',
                background: 'white',
                cursor: 'pointer'
              }}
            >
              {cadences.length === 0 ? (
                <option value="">No cadences available - Create one first!</option>
              ) : (
                cadences.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || "Unnamed Cadence"}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Contact Fields - Side by side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#5f6368', marginBottom: '6px', fontWeight: 500 }}>
                First Name
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="John"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #dadce0',
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontFamily: 'Google Sans, Roboto, Arial, sans-serif'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#5f6368', marginBottom: '6px', fontWeight: 500 }}>
                Last Name
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #dadce0',
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontFamily: 'Google Sans, Roboto, Arial, sans-serif'
                }}
              />
            </div>
          </div>

          {/* Company */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#5f6368', marginBottom: '6px', fontWeight: 500 }}>
              Company
            </label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Acme Corp"
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #dadce0',
                borderRadius: '4px',
                fontSize: '14px',
                fontFamily: 'Google Sans, Roboto, Arial, sans-serif'
              }}
            />
          </div>

          {/* To Field */}
          <div style={{ borderBottom: '1px solid #e8eaed', padding: '8px 0', display: 'flex', alignItems: 'center' }}>
            <span style={{ color: '#5f6368', fontSize: '14px', minWidth: '60px' }}>To</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john.doe@example.com"
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                fontSize: '14px',
                fontFamily: 'Google Sans, Roboto, Arial, sans-serif',
                color: '#202124'
              }}
            />
          </div>

          {/* Subject Field */}
          <div style={{ borderBottom: '1px solid #e8eaed', padding: '8px 0', display: 'flex', alignItems: 'center' }}>
            <span style={{ color: '#5f6368', fontSize: '14px', minWidth: '60px' }}>Subject</span>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject..."
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                fontSize: '14px',
                fontFamily: 'Google Sans, Roboto, Arial, sans-serif',
                color: '#202124'
              }}
            />
          </div>

          {/* Email Body - Editable */}
          <div style={{ padding: '16px 0' }}>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Email body..."
              style={{
                width: '100%',
                minHeight: '300px',
                fontSize: '14px',
                lineHeight: '1.6',
                color: '#202124',
                fontFamily: 'Arial, sans-serif',
                border: 'none',
                outline: 'none',
                resize: 'vertical'
              }}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid #e8eaed', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={handleSend}
            disabled={sending || !email || !firstName || !lastName || !company || !selectedCadenceId}
            style={{
              background: '#1a73e8',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '8px 24px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'Google Sans, Roboto, Arial, sans-serif',
              boxShadow: '0 1px 2px 0 rgba(60,64,67,0.3), 0 1px 3px 1px rgba(60,64,67,0.15)',
              opacity: (sending || !email || !firstName || !lastName || !company || !selectedCadenceId) ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
            onMouseOver={(e) => {
              if (!sending && email && firstName && lastName && company && selectedCadenceId) {
                e.currentTarget.style.background = '#1765cc';
                e.currentTarget.style.boxShadow = '0 1px 3px 0 rgba(60,64,67,0.3), 0 4px 8px 3px rgba(60,64,67,0.15)';
              }
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = '#1a73e8';
              e.currentTarget.style.boxShadow = '0 1px 2px 0 rgba(60,64,67,0.3), 0 1px 3px 1px rgba(60,64,67,0.15)';
            }}
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Send & Add to Cadence
              </>
            )}
          </button>
          <span style={{ fontSize: '12px', color: '#5f6368' }}>
            This will add the contact to your CRM and start the cadence
          </span>
        </div>
      </div>
    </div>
  );
}
