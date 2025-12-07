"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { signInWithGoogle, signInWithGoogleDirect, getSession } from "@/lib/auth";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SignInPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Check if user is already signed in
    const checkSession = async () => {
      try {
        // Add timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 3000)
        );
        
        const sessionPromise = getSession();
        const session = await Promise.race([sessionPromise, timeoutPromise]).catch(() => null) as any;
        
        if (session) {
          router.push("/people");
        } else {
          setChecking(false);
        }
      } catch (error) {
        console.error('Session check error:', error);
        // On error, just show the sign-in page
        setChecking(false);
      }
    };
    
    // Small delay to ensure page is mounted
    const timer = setTimeout(() => {
      checkSession();
    }, 100);
    
    return () => clearTimeout(timer);
  }, [router]);

  const handleSignIn = async () => {
    try {
      setLoading(true);
      // Use direct Google OAuth to bypass Supabase's scope limitations
      await signInWithGoogleDirect();
      // The redirect will happen automatically via OAuth flow
    } catch (error) {
      console.error("Sign in error:", error);
      setLoading(false);
    }
  };

  // Check for OAuth errors in URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');
    const message = params.get('message');
    
    if (error === 'scopes_not_granted') {
      const missing = params.get('missing')?.split(',') || [];
      const actual = params.get('actual')?.split(',') || [];
      const customMessage = params.get('message');
      
      const errorMsg = customMessage || (
        `❌ Google did not grant required permissions!\n\n` +
        `Missing scopes: ${missing.join(', ')}\n` +
        `Actual scopes granted: ${actual.join(', ') || 'NONE'}\n\n` +
        `Please:\n` +
        `1. Make sure you grant ALL permissions on the Google consent screen\n` +
        `2. Look for "Send email on your behalf" and "View/edit calendars" permissions\n` +
        `3. If you don't see these, you may need to revoke app access in Google Account settings first`
      );
      
      alert(errorMsg);
      
      // Clear the error params to prevent re-triggering
      window.history.replaceState({}, '', '/auth/signin');
    } else if (error === 'scope_required' && message) {
      alert(decodeURIComponent(message));
      // Clear the error params to prevent re-triggering
      window.history.replaceState({}, '', '/auth/signin');
    }
  }, []);

  if (checking) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted/20">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-muted-foreground"
        >
          Loading...
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        className="w-full max-w-md"
      >
        {/* Logo & Title Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="mb-8 text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 15 }}
            className="mx-auto mb-6 flex h-24 w-24 items-center justify-center"
          >
            <img 
              src="/logo.png" 
              alt="Cheddar Logo" 
              className="h-24 w-24"
            />
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="text-3xl font-bold text-foreground mb-2"
          >
            Cheddar
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.4 }}
            className="text-muted-foreground text-lg"
          >
            Sign in to access your CRM
          </motion.p>
        </motion.div>

        {/* Sign In Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="rounded-2xl border-2 border-border bg-card/50 backdrop-blur-sm p-8 shadow-xl shadow-black/5"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            <Button
              onClick={handleSignIn}
              disabled={loading}
              className="w-full h-12 text-base font-medium shadow-md hover:shadow-lg transition-all duration-200 bg-white text-gray-700 hover:bg-gray-50 border border-gray-300"
              size="lg"
            >
              {loading ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-2"
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="h-5 w-5 rounded-full border-2 border-gray-400 border-t-transparent"
                  />
                  Signing in...
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.7 }}
                  className="flex items-center justify-center gap-3"
                >
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </motion.div>
              )}
            </Button>
          </motion.div>

          {/* Footer */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-6 text-center text-xs text-muted-foreground"
          >
            By continuing, you agree to our Terms of Service and Privacy Policy
          </motion.p>
        </motion.div>

        {/* Decorative elements */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="mt-8 flex justify-center gap-2"
        >
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-primary/30"
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.3, 0.6, 0.3],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: i * 0.2,
              }}
            />
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
}

