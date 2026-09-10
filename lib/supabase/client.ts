'use client'

import { createBrowserClient } from '@supabase/ssr'

/**
 * Browser Supabase client. Safe to hold the anon key: every table this app
 * touches has RLS on, so the key alone reads nothing.
 */
export function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
