"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';

export default function APITestPage() {
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [testType, setTestType] = useState<'all' | 'gmail' | 'calendar' | 'vapi'>('all');

  const runTests = async () => {
    setLoading(true);
    setResults(null);

    try {
      const response = await fetch('/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test_type: testType === 'all' ? undefined : testType }),
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
        <h1 className="text-3xl font-bold mb-6">API Test Suite</h1>
        
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Test Configuration</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Test Type</label>
              <select
                value={testType}
                onChange={(e) => setTestType(e.target.value as any)}
                className="w-full p-2 border rounded"
              >
                <option value="all">All APIs</option>
                <option value="gmail">Gmail API Only</option>
                <option value="calendar">Calendar API Only</option>
                <option value="vapi">VAPI Only</option>
              </select>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
              <p className="text-sm font-medium text-yellow-800 mb-2">⚠️ Important Notes:</p>
              <ul className="text-sm text-yellow-700 space-y-1 list-disc list-inside">
                <li>Make sure you're signed in with Google OAuth</li>
                <li>VAPI requires VAPI_PHONE_NUMBER_ID in .env.local</li>
                <li>Tests will send to: sg.suriya.v@gmail.com</li>
                <li>VAPI will call: +1 (925) 577-2134</li>
              </ul>
            </div>

            <Button
              onClick={runTests}
              disabled={loading}
              className="w-full"
            >
              {loading ? 'Running Tests...' : 'Run Tests'}
            </Button>
          </div>
        </div>

        {results && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Test Results</h2>
            
            {results.error ? (
              <div className="bg-red-50 border border-red-200 rounded p-4">
                <p className="text-red-800 font-medium">Error:</p>
                <p className="text-red-700">{results.error}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {results.results?.gmail && (
                  <div className={`border rounded p-4 ${results.results.gmail.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <h3 className="font-semibold mb-2">
                      📧 Gmail API: {results.results.gmail.success ? '✅ Success' : '❌ Failed'}
                    </h3>
                    {results.results.gmail.success ? (
                      <div className="text-sm space-y-1">
                        <p><strong>Message ID:</strong> {results.results.gmail.messageId}</p>
                        <p><strong>Thread ID:</strong> {results.results.gmail.threadId}</p>
                        <p className="text-green-700">Check sg.suriya.v@gmail.com inbox!</p>
                      </div>
                    ) : (
                      <p className="text-red-700">{results.results.gmail.error}</p>
                    )}
                  </div>
                )}

                {results.results?.calendar && (
                  <div className={`border rounded p-4 ${results.results.calendar.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <h3 className="font-semibold mb-2">
                      📅 Calendar API: {results.results.calendar.success ? '✅ Success' : '❌ Failed'}
                    </h3>
                    {results.results.calendar.success ? (
                      <div className="text-sm space-y-1">
                        <p><strong>Event ID:</strong> {results.results.calendar.eventId}</p>
                        <p className="text-green-700">Check sg.suriya.v@gmail.com calendar!</p>
                      </div>
                    ) : (
                      <p className="text-red-700">{results.results.calendar.error}</p>
                    )}
                  </div>
                )}

                {results.results?.vapi && (
                  <div className={`border rounded p-4 ${results.results.vapi.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <h3 className="font-semibold mb-2">
                      📞 VAPI: {results.results.vapi.success ? '✅ Success' : '❌ Failed'}
                    </h3>
                    {results.results.vapi.success ? (
                      <div className="text-sm space-y-1">
                        <p><strong>Call ID:</strong> {results.results.vapi.callId}</p>
                        <p><strong>Status:</strong> {results.results.vapi.status}</p>
                        <p className="text-green-700">Check your phone +1 (925) 577-2134!</p>
                      </div>
                    ) : (
                      <div className="text-sm">
                        <p className="text-red-700 font-medium">{results.results.vapi.error}</p>
                        {results.results.vapi.error?.includes('VAPI_PHONE_NUMBER_ID') && (
                          <p className="text-red-600 mt-2">
                            ⚠️ VAPI_PHONE_NUMBER_ID is missing. Get it from VAPI dashboard and add to .env.local
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="text-xs text-gray-500 mt-4">
                  Timestamp: {results.timestamp}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

