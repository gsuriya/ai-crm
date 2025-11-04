"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function VoiceCallTestPage() {
  const [phoneNumber, setPhoneNumber] = useState("+19255772134");
  const [companyName, setCompanyName] = useState("Test Company");
  const [customPrompt, setCustomPrompt] = useState("");
  const [voicemailMessage, setVoicemailMessage] = useState("");
  const [isCalling, setIsCalling] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTestCall = async () => {
    setIsCalling(true);
    setResult(null);
    setError(null);
    
    try {
      console.log('📞 Making test voice call to:', phoneNumber);
      console.log('📞 Company:', companyName);
      console.log('📞 Custom Prompt:', customPrompt || '(using default/system prompt)');
      
      const response = await fetch('/api/voice-call/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_number: phoneNumber,
          company_id: 'test-company-id',
          cadence_id: 'test-cadence-id',
          company_name: companyName,
          custom_prompt: customPrompt || undefined,
          voicemail_message: voicemailMessage || undefined,
          enable_voicemail_fallback: true,
        }),
      });
      
      const data = await response.json();
      console.log('📞 Response:', data);
      
      if (response.ok) {
        setResult(data);
        console.log('✅ Voice call initiated successfully! Call ID:', data.callId);
      } else {
        const errorMsg = data.error || data.details || 'Failed to make call';
        console.error('❌ Call failed:', errorMsg);
        setError(errorMsg);
      }
    } catch (err: any) {
      console.error('❌ Network error:', err);
      setError(err.message || 'Failed to make call');
    } finally {
      setIsCalling(false);
    }
  };

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">📞 Voice Call Test (Riley Agent)</h1>
      
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h2 className="font-semibold text-blue-900 mb-2">ℹ️ About This Test</h2>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>This will initiate a full AI voice agent call (two-way conversation)</li>
          <li>Uses Riley assistant (ID: 11182291-6fa9-46d2-8127-5a8b4536e00e)</li>
          <li>System prompt is automatically included from code (unless custom prompt provided)</li>
          <li>If call goes to voicemail, will leave voicemail message</li>
        </ul>
      </div>

      <div className="space-y-4 bg-white rounded-lg shadow p-6">
        <div>
          <label className="text-sm font-medium mb-1 block">Phone Number *</label>
          <Input
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="+19255772134"
            className="w-full"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Must include country code (e.g., +1 for US)
          </p>
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block">Company Name</label>
          <Input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Test Company"
            className="w-full"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Will be used to personalize the first message
          </p>
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block">
            Custom System Prompt (Optional)
          </label>
          <textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="Leave empty to use default system prompt from VAPI dashboard"
            className="w-full min-h-[120px] p-3 border rounded bg-white text-gray-900 placeholder:text-gray-400"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Override the AI agent&apos;s behavior. Leave empty to use what&apos;s configured in VAPI dashboard.
          </p>
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block">
            Custom Voicemail Message (Optional)
          </label>
          <textarea
            value={voicemailMessage}
            onChange={(e) => setVoicemailMessage(e.target.value)}
            placeholder="Leave empty to use default voicemail message"
            className="w-full min-h-[80px] p-3 border rounded bg-white text-gray-900 placeholder:text-gray-400"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Message to leave if call goes to voicemail
          </p>
        </div>

        <Button
          onClick={handleTestCall}
          disabled={isCalling || !phoneNumber}
          className="w-full"
          size="lg"
        >
          {isCalling ? "📞 Calling..." : "📞 Make Voice Call"}
        </Button>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-4">
            <h3 className="font-semibold text-red-900 mb-1">❌ Error</h3>
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {result && (
          <div className="bg-green-50 border border-green-200 rounded p-4">
            <h3 className="font-semibold text-green-900 mb-2">✅ Call Initiated!</h3>
            <div className="text-sm text-green-800 space-y-1">
              <p><strong>Call ID:</strong> {result.callId}</p>
              <p><strong>Status:</strong> {result.status}</p>
              {result.contentLog && (
                <p><strong>Logged:</strong> Yes</p>
              )}
            </div>
            <div className="mt-3 text-xs text-green-700">
              <p>💡 Check your phone - Riley should be calling now!</p>
              <p>💡 Check VAPI dashboard for call details and transcript</p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 bg-gray-50 rounded-lg p-4">
        <h2 className="font-semibold mb-2">📋 Current Configuration</h2>
        <div className="text-sm space-y-1">
          <p><strong>Assistant ID:</strong> {process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID || '11182291-6fa9-46d2-8127-5a8b4536e00e (Riley - default)'}</p>
            <p><strong>System Prompt:</strong> Always uses code-defined system prompt (unless custom prompt provided)</p>
          <p><strong>Voice:</strong> Configured in VAPI dashboard for Riley assistant</p>
        </div>
      </div>
    </div>
  );
}
