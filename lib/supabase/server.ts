import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

/** Request-scoped client that carries the signed-in user's session. */
export async function supabaseServer() {
  const store = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (list) => {
          // Server Components cannot set cookies. Refresh happens in middleware
          // instead, so swallowing here is correct rather than lazy.
          try {
            list.forEach(({ name, value, options }) => store.set(name, value, options))
          } catch {}
        },
      },
    },
  )
}

/**
 * Service-role client. Bypasses RLS — only ever call this from a route handler,
 * never from anything that renders.
 *
 * Throws rather than falling back to the anon key: the tables this is for
 * (`referral_event`, `referral_order`, `reward_claim`) have RLS on with no
 * insert policy, so an anon fallback would fail silently on every write.
 */
export function supabaseService() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false },
  })
}
