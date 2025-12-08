"use client";

import { useState, useEffect } from "react";
import { Send, Loader2, Zap, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

interface AddToCadenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AddToCadenceModal({ isOpen, onClose, onSuccess }: AddToCadenceModalProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [company, setCompany] = useState("");
  const [cadences, setCadences] = useState<any[]>([]);
  const [selectedCadenceId, setSelectedCadenceId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const [limitInfo, setLimitInfo] = useState<{ peopleAdded: number; limit: number } | null>(null);

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
      console.log("No cadence or nodes found");
      setSubject("");
      setBody("");
      return;
    }

    console.log("Loading preview for cadence:", cadence.name);
    console.log("Nodes:", cadence.nodes);

    // Find start/trigger node
    const startNode = cadence.nodes.find((n: any) => n.type === "start" || n.type === "trigger");
    if (!startNode) {
      console.log("No start/trigger node found");
      setSubject("");
      setBody("");
      return;
    }
    console.log("Found start node:", startNode.id, startNode.connections);

    // Get the first connection from the start node (it's an array of IDs)
    const firstConnectionId = startNode.connections && startNode.connections.length > 0 
      ? startNode.connections[0] 
      : null;

    if (!firstConnectionId) {
      console.log("No connections from start node");
      setSubject("");
      setBody("");
      return;
    }

    console.log("First connection ID:", firstConnectionId);

    // Find the node with this ID
    const firstEmailNode = cadence.nodes.find(
      (n: any) => n.id === firstConnectionId && n.type === "email"
    );
    console.log("First email node:", firstEmailNode);

    if (firstEmailNode && firstEmailNode.config) {
      const rawSubject = firstEmailNode.config.subject || "";
      const rawBody = firstEmailNode.config.body || "";
      
      console.log("Setting subject:", rawSubject);
      console.log("Setting body:", rawBody);
      
      setSubject(replaceVariables(rawSubject));
      setBody(replaceVariables(rawBody));
    } else {
      console.log("No email node found or no config");
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

    if (!subject || !body) {
      alert("Please wait for the email template to load");
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
          emailSubject: subject,
          emailBody: body,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        
        // Check if it's a limit reached error
        if (error.limitReached) {
          setLimitReached(true);
          setLimitInfo({
            peopleAdded: error.peopleAdded || 5,
            limit: error.limit || 5,
          });
          return;
        }
        
        throw new Error(error.error || "Failed to add to cadence");
      }

      const result = await response.json();
      alert(`✅ Success! Email sent to ${firstName} ${lastName} and added to cadence!`);
      
      setEmail("");
      setFirstName("");
      setLastName("");
      setCompany("");
      setSubject("");
      setBody("");
      setLimitReached(false);
      setLimitInfo(null);
      
      onSuccess?.();
      onClose();
    } catch (error: any) {
      console.error("Error adding to cadence:", error);
      alert(`❌ Error: ${error.message}`);
    } finally {
      setSending(false);
    }
  };
  
  const handleUpgrade = () => {
    onClose();
    router.push('/upgrade');
  };

  if (!isOpen) return null;

  // Show upgrade prompt if limit reached
  if (limitReached) {
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(4px)'
        }}
        onClick={onClose}
      >
        <div
          style={{
            background: 'white',
            borderRadius: '16px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
            width: '440px',
            maxWidth: '90vw',
            padding: '32px',
            textAlign: 'center',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{
            width: '64px',
            height: '64px',
            background: '#FEF3C7',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
          }}>
            <AlertCircle style={{ width: '32px', height: '32px', color: '#F59E0B' }} />
          </div>
          
          <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#111', marginBottom: '8px' }}>
            Free Plan Limit Reached
          </h2>
          
          <p style={{ color: '#666', fontSize: '14px', marginBottom: '24px', lineHeight: '1.6' }}>
            You've used all {limitInfo?.limit || 5} cadence adds on the free plan.
            Upgrade to Pro for unlimited cadence adds and keep growing your outreach.
          </p>
          
          <div style={{
            background: '#F3F4F6',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '24px',
          }}>
            <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>
              Pro Plan includes:
            </div>
            <ul style={{ textAlign: 'left', fontSize: '13px', color: '#333', margin: 0, paddingLeft: '20px' }}>
              <li style={{ marginBottom: '4px' }}>✓ Unlimited cadence adds</li>
              <li style={{ marginBottom: '4px' }}>✓ Priority email delivery</li>
              <li style={{ marginBottom: '4px' }}>✓ Advanced analytics</li>
              <li>✓ Priority support</li>
            </ul>
          </div>
          
          <button
            onClick={handleUpgrade}
            style={{
              width: '100%',
              padding: '14px 24px',
              background: '#4F46E5',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '15px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              marginBottom: '12px',
            }}
          >
            <Zap style={{ width: '18px', height: '18px' }} />
            Upgrade to Pro - $30/month
          </button>
          
          <button
            onClick={() => { setLimitReached(false); onClose(); }}
            style={{
              width: '100%',
              padding: '12px 24px',
              background: 'transparent',
              color: '#666',
              border: 'none',
              borderRadius: '10px',
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            Maybe later
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '8px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          width: '700px',
          maxWidth: '90vw',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'Google Sans, Roboto, Arial, sans-serif'
        }}
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
                color: '#202124',
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

          {/* Contact Fields */}
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
                  fontFamily: 'Google Sans, Roboto, Arial, sans-serif',
                  background: 'white',
                  color: '#202124'
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
                  fontFamily: 'Google Sans, Roboto, Arial, sans-serif',
                  background: 'white',
                  color: '#202124'
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
                fontFamily: 'Google Sans, Roboto, Arial, sans-serif',
                background: 'white',
                color: '#202124'
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
                color: '#202124',
                background: 'transparent'
              }}
            />
          </div>

          {/* Subject */}
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
                color: '#202124',
                background: 'transparent'
              }}
            />
          </div>

          {/* Email Body */}
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
                resize: 'vertical',
                background: 'white'
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
              cursor: sending || !email || !firstName || !lastName || !company || !selectedCadenceId ? 'not-allowed' : 'pointer',
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
                <Loader2 style={{ width: '16px', height: '16px' }} className="animate-spin" />
                <span>Sending...</span>
              </>
            ) : (
              <>
                <Send style={{ width: '16px', height: '16px' }} />
                <span>Send & Add to Cadence</span>
              </>
            )}
          </button>
          <span style={{ fontSize: '12px', color: '#5f6368' }}>
            This will send the email above, add the contact to your CRM, and continue the cadence from step 2
          </span>
        </div>
      </div>
    </div>
  );
}
