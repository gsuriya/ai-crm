import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || ''

// Validate URL format
const isValidUrl = supabaseUrl && (supabaseUrl.startsWith('http://') || supabaseUrl.startsWith('https://'))

// Create a browser client that properly handles cookies
if (!isValidUrl || !supabaseAnonKey) {
  console.error('Missing Supabase credentials:', {
    hasUrl: !!supabaseUrl,
    urlLength: supabaseUrl.length,
    hasKey: !!supabaseAnonKey,
    url: supabaseUrl.substring(0, 50) + '...'
  })
}

export const supabase = isValidUrl && supabaseAnonKey
  ? createBrowserClient(supabaseUrl, supabaseAnonKey)
  : createBrowserClient('https://placeholder.supabase.co', 'placeholder-key')
