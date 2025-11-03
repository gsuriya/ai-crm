"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";

/**
 * Page to complete sign-in after direct Google OAuth
 * This reads tokens from the cookie and completes the Supabase sign-in
 */
export default function CompleteSignInPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Completing sign-in...');

  useEffect(() => {
    const completeSignIn = async () => {
      try {
        // Get tokens from cookie via API route
        const response = await fetch('/api/auth/complete-signin', {
          method: 'POST',
          credentials: 'include',
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to complete sign-in');
        }

        const data = await response.json();
        
        if (data.success) {
          setStatus('success');
          setMessage('Sign-in completed! Redirecting...');
          setTimeout(() => {
            router.push('/companies');
          }, 1500);
        } else {
          throw new Error(data.error || 'Sign-in failed');
        }
      } catch (error: any) {
        console.error('Error completing sign-in:', error);
        setStatus('error');
        setMessage(`Error: ${error.message}. Please try signing in again.`);
        setTimeout(() => {
          router.push('/auth/signin');
        }, 3000);
      }
    };

    completeSignIn();
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted/20">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center space-y-4"
      >
        {status === 'loading' && (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="h-12 w-12 rounded-full border-4 border-primary border-t-transparent mx-auto"
          />
        )}
        {status === 'success' && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="h-12 w-12 rounded-full bg-green-500 mx-auto flex items-center justify-center"
          >
            <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </motion.div>
        )}
        {status === 'error' && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="h-12 w-12 rounded-full bg-red-500 mx-auto flex items-center justify-center"
          >
            <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </motion.div>
        )}
        <p className="text-muted-foreground">{message}</p>
      </motion.div>
    </div>
  );
}





