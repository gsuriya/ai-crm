'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { signInWithGoogleDirect } from '@/lib/auth';

export default function SimpleEmailTestPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [diagnosis, setDiagnosis] = useState<any>(null);

  const diagnose = async () => {
    try {
      const response = await fetch('/api/diagnose-oauth');
      const data = await response.json();
      setDiagnosis(data);
    } catch (error: any) {
      console.error('Diagnosis error:', error);
    }
  };

  useEffect(() => {
    diagnose();
    
    // Check if we just came back from successful OAuth
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('success') === 'true') {
      setResult('✅ OAuth successful! Tokens stored. Try sending an email now.');
      // Remove success param from URL
      window.history.replaceState({}, '', '/test-email');
    }
  }, []);

  const sendTestEmail = async () => {
    try {
      setLoading(true);
      setResult(null);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setResult('❌ Not authenticated');
        return;
      }

      console.log('[Test Email] Starting email send...');
      console.log('[Test Email] User ID:', user.id);

      // Call API to send email
      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: 'sg.suriya.v@gmail.com',
          subject: 'yo',
          body: 'Test email from simple test page',
        }),
      });

      const data = await response.json();
      console.log('[Test Email] Response:', { status: response.status, data });

      if (response.ok) {
        setResult(`✅ Email sent successfully!\n\nMessage ID: ${data.messageId}\nThread ID: ${data.threadId}\nGmail ID: ${data.gmailMessageId}`);
      } else {
        const errorMsg = data.error || 'Unknown error';
        console.error('[Test Email] Error:', errorMsg);
        setResult(`❌ Error: ${errorMsg}`);
        
        // If it's a scope error, suggest re-authentication
        if (errorMsg.includes('insufficient') || errorMsg.includes('scope') || errorMsg.includes('permission')) {
          setResult(
            `❌ Error: ${errorMsg}\n\n` +
            `🔴 Your Google account doesn't have permission to send emails.\n\n` +
            `✅ SOLUTION: Click the red "Fix OAuth" button below to authenticate directly with Google ` +
            `and grant ALL permissions, especially "Send email on your behalf".`
          );
        }
      }
    } catch (error: any) {
      console.error('[Test Email] Exception:', error);
      setResult(`❌ Error: ${error.message || 'Failed to send email'}`);
    } finally {
      setLoading(false);
      diagnose(); // Re-diagnose after attempt
    }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Simple Email Test</h1>
      
      <div className="bg-white border rounded-lg p-6 space-y-4">
        <div>
          <p className="text-sm text-gray-600 mb-2">
            Click the button below to send a test email to <strong>sg.suriya.v@gmail.com</strong>
          </p>
          <p className="text-xs text-gray-500">
            Subject: &quot;yo&quot;<br />
            Body: &quot;Test email from simple test page&quot;
          </p>
        </div>

        {diagnosis && (
          <div className={`p-4 rounded border ${
            diagnosis.problem === 'TOKENS_VALID' 
              ? 'bg-green-50 border-green-200' 
              : 'bg-yellow-50 border-yellow-200'
          }`}>
            <h3 className="font-bold mb-2">🔍 Diagnosis:</h3>
            <p className="text-sm mb-2"><strong>Problem:</strong> {diagnosis.problem}</p>
            <p className="text-sm mb-2">{diagnosis.message}</p>
            <div className="mt-3 p-3 bg-white rounded border">
              <p className="text-xs font-semibold mb-1">Solution:</p>
              <pre className="text-xs whitespace-pre-wrap">{diagnosis.solution}</pre>
            </div>
            {diagnosis.details?.googleCloudConsole && (
              <div className="mt-3 text-xs">
                <p className="font-semibold mb-1">Google Cloud Console Links:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li><a href={diagnosis.details.googleCloudConsole.checkOAuthConsentScreen} target="_blank" className="text-blue-600 underline">Check OAuth Consent Screen</a></li>
                  <li>{diagnosis.details.googleCloudConsole.checkScopes}</li>
                  <li>{diagnosis.details.googleCloudConsole.checkTestUsers}</li>
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="space-y-2">
          <Button
            onClick={sendTestEmail}
            disabled={loading}
            className="w-full"
          >
            {loading ? 'Sending...' : 'Send Test Email'}
          </Button>
          
          <Button
            onClick={() => {
              window.location.href = '/api/auth/passport-google';
            }}
            variant="destructive"
            className="w-full"
          >
            🔴 Fix OAuth - Use Passport.js Style (Like Sourcing Directory)
          </Button>
        </div>

        {result && (
          <div className={`p-4 rounded ${
            result.startsWith('✅') 
              ? 'bg-green-50 border border-green-200 text-green-800' 
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            <pre className="whitespace-pre-wrap text-sm">{result}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

