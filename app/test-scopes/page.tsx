'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { signInWithGoogle, signInWithGoogleDirect } from '@/lib/auth';

export default function TestScopesPage() {
  const [scopes, setScopes] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkScopes();
  }, []);

  const checkScopes = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/debug/scopes');
      const data = await response.json();
      setScopes(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReAuth = async () => {
    try {
      // Use direct OAuth to bypass Supabase and get correct scopes
      await signInWithGoogleDirect();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) {
    return <div className="p-8">Loading scope information...</div>;
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Token Scope Checker</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          Error: {error}
        </div>
      )}

      {scopes && (
        <div className="space-y-4">
          <div className="bg-white border rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Stored Scopes</h2>
            <ul className="list-disc list-inside space-y-1">
              {scopes.storedScopes?.map((scope: string) => (
                <li key={scope} className="text-sm">{scope}</li>
              ))}
            </ul>
          </div>

          <div className="bg-white border rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Actual Scopes from Google</h2>
            {scopes.actualScopesFromGoogle ? (
              <ul className="list-disc list-inside space-y-1">
                {scopes.actualScopesFromGoogle.map((scope: string) => (
                  <li key={scope} className="text-sm">{scope}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">Could not fetch scopes from Google</p>
            )}
          </div>

          <div className="bg-white border rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Status</h2>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-medium">Has gmail.send:</span>
                <span className={scopes.hasGmailSend ? 'text-green-600' : 'text-red-600'}>
                  {scopes.hasGmailSend ? '✅ Yes' : '❌ No'}
                </span>
              </div>
              {scopes.missingScopes && scopes.missingScopes.length > 0 && (
                <div>
                  <span className="font-medium">Missing Scopes:</span>
                  <ul className="list-disc list-inside mt-1">
                    {scopes.missingScopes.map((scope: string) => (
                      <li key={scope} className="text-sm text-red-600">{scope}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={checkScopes}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Refresh Scopes
            </button>
            <button
              onClick={handleReAuth}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Re-authenticate with Google
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

