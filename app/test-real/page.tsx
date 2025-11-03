"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';

export default function RealAPITestPage() {
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const runTests = async () => {
    setLoading(true);
    setResults(null);

    try {
      const response = await fetch('/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test_type: undefined }), // Test all
      });

      const data = await response.json();
      setResults(data);
    } catch (error: any) {
      setResults({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Real API Test Suite</h1>
        <p className="text-gray-600 mb-6">
          This will send REAL emails, make REAL calls, and send REAL calendar invites!
        </p>
        
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded p-4 mb-4">
            <p className="text-sm font-medium text-yellow-800 mb-2">⚠️ Important:</p>
            <ul className="text-sm text-yellow-700 space-y-1 list-disc list-inside">
              <li>Make sure you're signed in with Google OAuth</li>
              <li>Email will be sent to: <strong>sg.suriya.v@gmail.com</strong></li>
              <li>Phone call will be made to: <strong>+1 (925) 577-2134</strong></li>
              <li>Calendar invite will be sent to: <strong>sg.suriya.v@gmail.com</strong></li>
            </ul>
          </div>

          <Button
            onClick={runTests}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700"
            size="lg"
          >
            {loading ? 'Running Tests...' : '🚀 Run All API Tests'}
          </Button>
        </div>

        {results && (
          <div className="bg-white rounded-lg shadow p-6 space-y-4">
            <h2 className="text-xl font-semibold mb-4">Test Results</h2>
            
            {results.error ? (
              <div className="bg-red-50 border border-red-200 rounded p-4">
                <p className="text-red-800 font-medium">Error:</p>
                <p className="text-red-700">{results.error}</p>
              </div>
            ) : (
              <>
                {results.results?.gmail && (
                  <div className={`border rounded p-4 ${results.results.gmail.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      📧 Gmail API: {results.results.gmail.success ? '✅ SUCCESS' : '❌ FAILED'}
                    </h3>
                    {results.results.gmail.success ? (
                      <div className="text-sm space-y-1">
                        <p><strong>Message ID:</strong> {results.results.gmail.messageId}</p>
                        <p><strong>Thread ID:</strong> {results.results.gmail.threadId}</p>
                        <p className="text-green-700 font-medium mt-2">
                          ✅ Check your inbox: sg.suriya.v@gmail.com
                        </p>
                      </div>
                    ) : (
                      <div className="text-sm">
                        <p className="text-red-700 font-medium">{results.results.gmail.error}</p>
                        {results.results.gmail.error?.includes('Session') && (
                          <p className="text-red-600 mt-2">
                            ⚠️ Please sign in with Google OAuth first
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {results.results?.calendar && (
                  <div className={`border rounded p-4 ${results.results.calendar.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      📅 Calendar API: {results.results.calendar.success ? '✅ SUCCESS' : '❌ FAILED'}
                    </h3>
                    {results.results.calendar.success ? (
                      <div className="text-sm space-y-1">
                        <p><strong>Event ID:</strong> {results.results.calendar.eventId}</p>
                        <p className="text-green-700 font-medium mt-2">
                          ✅ Check your calendar: sg.suriya.v@gmail.com
                        </p>
                      </div>
                    ) : (
                      <div className="text-sm">
                        <p className="text-red-700 font-medium">{results.results.calendar.error}</p>
                      </div>
                    )}
                  </div>
                )}

                {results.results?.vapi && (
                  <div className={`border rounded p-4 ${results.results.vapi.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      📞 VAPI: {results.results.vapi.success ? '✅ SUCCESS' : '❌ FAILED'}
                    </h3>
                    {results.results.vapi.success ? (
                      <div className="text-sm space-y-1">
                        <p><strong>Call ID:</strong> {results.results.vapi.callId}</p>
                        <p><strong>Status:</strong> {results.results.vapi.status}</p>
                        <p className="text-green-700 font-medium mt-2">
                          ✅ Answer your phone: +1 (925) 577-2134
                        </p>
                        <p className="text-green-600 text-xs mt-1">
                          The call should come through in a few seconds!
                        </p>
                      </div>
                    ) : (
                      <div className="text-sm">
                        <p className="text-red-700 font-medium">{results.results.vapi.error}</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="text-xs text-gray-500 mt-4 pt-4 border-t">
                  Timestamp: {results.timestamp}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

