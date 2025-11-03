import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Create a Supabase client for server-side API routes that properly reads auth cookies
 * Uses @supabase/ssr for proper Next.js 14 cookie handling
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: any) {
        // Server-side can't set cookies via this method
        // Cookies are managed by the client-side Supabase instance
      },
      remove(name: string, options: any) {
        // Server-side can't remove cookies via this method
      },
    },
  });
}

