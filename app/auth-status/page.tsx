'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { signInWithGoogleDirect } from '@/lib/auth';

export default function AuthStatusPage() {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      setLoading(true);
      
      // Check Supabase session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      // Check user_sessions table (only if we have a session)
      let userSession = null;
      let userSessionError = null;
      if (session?.user?.id) {
        const result = await supabase
          .from('user_sessions')
          .select('*')
          .eq('user_id', session.user.id)
          .maybeSingle();
        userSession = result.data;
        userSessionError = result.error;
      }

      setStatus({
        supabaseSession: {
          hasSession: !!session,
          userId: session?.user?.id,
          email: session?.user?.email,
          error: sessionError?.message,
        },
        googleToken: {
          hasToken: !!userSession?.access_token,
          email: userSession?.email,
          scope: userSession?.scope,
          expiresAt: userSession?.token_expires_at,
          isExpired: userSession?.token_expires_at 
            ? new Date(userSession.token_expires_at) < new Date() 
            : null,
          error: userSessionError?.message,
        },
      });
    } catch (err: any) {
      setStatus({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleReAuth = async () => {
    try {
      await signInWithGoogleDirect();
      // This will redirect to Google, so we don't need to handle the response here
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  if (loading) {
    return <div className="p-8">Checking auth status...</div>;
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Auth Status</h1>
      
      {status?.error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          Error: {status.error}
        </div>
      )}

      <div className="space-y-4">
        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Supabase Session</h2>
          <div className="space-y-2">
            <div>
              <span className="font-medium">Has Session:</span>{' '}
              <span className={status?.supabaseSession?.hasSession ? 'text-green-600' : 'text-red-600'}>
                {status?.supabaseSession?.hasSession ? '✅ Yes' : '❌ No'}
              </span>
            </div>
            <div>
              <span className="font-medium">Email:</span> {status?.supabaseSession?.email || 'N/A'}
            </div>
            {status?.supabaseSession?.error && (
              <div className="text-red-600">
                Error: {status.supabaseSession.error}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Google OAuth Token</h2>
          <div className="space-y-2">
            <div>
              <span className="font-medium">Has Token:</span>{' '}
              <span className={status?.googleToken?.hasToken ? 'text-green-600' : 'text-red-600'}>
                {status?.googleToken?.hasToken ? '✅ Yes' : '❌ No'}
              </span>
            </div>
            <div>
              <span className="font-medium">Email:</span> {status?.googleToken?.email || 'N/A'}
            </div>
            <div>
              <span className="font-medium">Scopes:</span>{' '}
              {status?.googleToken?.scope ? (
                <ul className="list-disc list-inside mt-1">
                  {status.googleToken.scope.split(' ').map((s: string) => (
                    <li key={s} className="text-sm">{s}</li>
                  ))}
                </ul>
              ) : (
                <span className="text-gray-500">None</span>
              )}
            </div>
            <div>
              <span className="font-medium">Expires At:</span>{' '}
              {status?.googleToken?.expiresAt 
                ? new Date(status.googleToken.expiresAt).toLocaleString()
                : 'N/A'}
            </div>
            <div>
              <span className="font-medium">Status:</span>{' '}
              {status?.googleToken?.isExpired === null ? (
                <span className="text-gray-500">Unknown</span>
              ) : status?.googleToken?.isExpired ? (
                <span className="text-red-600">❌ EXPIRED</span>
              ) : (
                <span className="text-green-600">✅ Valid</span>
              )}
            </div>
            {status?.googleToken?.error && (
              <div className="text-red-600">
                Error: {status.googleToken.error}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-4">
          <button
            onClick={checkAuth}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Refresh Status
          </button>
          <button
            onClick={handleReAuth}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Re-authenticate with Google
          </button>
        </div>
      </div>
    </div>
  );
}

