import { supabaseServer } from '@/lib/supabase/server'
import type { Partner, PartnerRole } from '@/lib/domain/types'
import { fail, ok, type Result } from './result'

export type Session = {
  userId: string
  email: string | null
  partner: Partner
  role: PartnerRole
}

/**
 * Who is signed in, and which firm they belong to.
 *
 * Returns `ok: true, data: null` for a signed-in user with no firm yet — that
 * is the onboarding case, not an error. A query that actually failed is
 * `ok: false`, so a broken database never looks like "you need to sign up",
 * which would invite a second firm to be created over the top of a real one.
 */
export async function currentSession(): Promise<Result<Session | null>> {
  const sb = await supabaseServer()
  const { data: auth, error: authErr } = await sb.auth.getUser()
  if (authErr) return fail(`Could not read your session: ${authErr.message}`)
  if (!auth.user) return ok(null)

  const { data, error } = await sb
    .from('partner_user')
    .select('role, partner:partner_id (*)')
    .eq('user_id', auth.user.id)
    .maybeSingle()

  if (error) return fail(`Could not load your firm: ${error.message}`)
  if (!data?.partner) return ok(null)

  return ok({
    userId: auth.user.id,
    email: auth.user.email ?? null,
    partner: data.partner as unknown as Partner,
    role: data.role as PartnerRole,
  })
}
