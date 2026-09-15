import { supabaseServer } from '@/lib/supabase/server'
import type { MyKam, Partner, PartnerRole, StaffUser } from '@/lib/domain/types'
import { fail, ok, type Result } from './result'

export type Session = {
  userId: string
  email: string | null
  partner: Partner
  role: PartnerRole
}

/**
 * Who is signed in, and what they are.
 *
 * Three kinds of people use this deployment and they get different apps:
 *
 * - `partner` — an architect or interior designer. Sees `app/(app)/**`.
 * - `staff`   — Material Depot's own team: admin, KAM, outreach, inbound.
 *               Sees `app/(console)/**` and never the partner app.
 * - `none`    — signed in and attached to neither. That is the onboarding case
 *               for a fresh partner sign-up, and it is also what a staff member
 *               sees before someone links their login (see the bootstrap
 *               snippet in supabase/migrations/README.md).
 *
 * A failed read is `ok: false`, never `none`. Offering the sign-up form because
 * a query errored would let a partner create a SECOND firm over the top of their
 * real one, and the new firm would be the one their referrals stopped matching.
 */
export type Actor =
  | { kind: 'partner'; userId: string; email: string | null; partner: Partner; role: PartnerRole }
  | { kind: 'staff'; userId: string; email: string | null; staff: StaffUser }
  | { kind: 'none'; userId: string; email: string | null }

export async function currentActor(): Promise<Result<Actor | null>> {
  const sb = await supabaseServer()
  const { data: auth, error: authErr } = await sb.auth.getUser()
  if (authErr) return fail(`Could not read your session: ${authErr.message}`)
  if (!auth.user) return ok(null)

  const [membership, staff] = await Promise.all([
    sb.from('partner_user').select('role, partner:partner_id (*)').eq('user_id', auth.user.id).maybeSingle(),
    sb.from('staff_user').select('*').eq('user_id', auth.user.id).eq('active', true).maybeSingle(),
  ])

  if (membership.error) return fail(`Could not load your firm: ${membership.error.message}`)
  if (staff.error) return fail(`Could not load your Material Depot role: ${staff.error.message}`)

  const email = auth.user.email ?? null

  // Staff wins if a login is somehow both. `onboard_partner()` refuses to create
  // a firm for a staff login, so this only happens if someone linked a staff row
  // to an existing partner login by hand — in which case the console is the safer
  // of the two to land them in, because it cannot show them another firm's work.
  if (staff.data) {
    return ok({ kind: 'staff', userId: auth.user.id, email, staff: staff.data as StaffUser })
  }
  if (membership.data?.partner) {
    return ok({
      kind: 'partner',
      userId: auth.user.id,
      email,
      partner: membership.data.partner as unknown as Partner,
      role: membership.data.role as PartnerRole,
    })
  }
  return ok({ kind: 'none', userId: auth.user.id, email })
}

/**
 * The partner-app view of the same thing, kept because every page under
 * `app/(app)/` already calls it. `ok: true, data: null` means "no firm" and is
 * the onboarding case, not an error.
 */
export async function currentSession(): Promise<Result<Session | null>> {
  const actor = await currentActor()
  if (!actor.ok) return actor
  if (!actor.data || actor.data.kind !== 'partner') return ok(null)
  const { userId, email, partner, role } = actor.data
  return ok({ userId, email, partner, role })
}

/**
 * The staff member the caller is, or null.
 *
 * `roles` narrows it: `requireStaff(['admin'])` returns a failure for a KAM.
 * This is the app-layer check. It is NOT the only check — every console table
 * has an RLS policy behind it, and the two writes that decide money
 * (`review_referral_order`, `review_portfolio_item`) re-check `app_is_admin()`
 * inside the database, so a mistake here cannot approve an order.
 */
export async function requireStaff(roles?: StaffUser['role'][]): Promise<Result<StaffUser>> {
  const actor = await currentActor()
  if (!actor.ok) return actor
  if (!actor.data) return fail('You are not signed in.')
  if (actor.data.kind !== 'staff') return fail('This is a Material Depot console action.')
  const staff = actor.data.staff
  if (roles && !roles.includes(staff.role)) {
    return fail(`This needs a Material Depot ${roles.join(' or ')}. You are signed in as ${staff.role}.`)
  }
  return ok(staff)
}

/**
 * The partner's KAM — name and number, nothing else about the staff table.
 *
 * Goes through the `my_kam()` function rather than a select, because a partner
 * has no read policy on `staff_user` and should not: knowing who looks after
 * you is not the same as being able to list Material Depot's org chart.
 *
 * Returns `ok: null` for a firm with no KAM assigned yet, which is a real state
 * and not a failure.
 */
export async function myKam(): Promise<Result<MyKam | null>> {
  const sb = await supabaseServer()
  const { data, error } = await sb.rpc('my_kam')
  if (error) return fail(`Could not load your Material Depot contact: ${error.message}`)
  const row = Array.isArray(data) ? data[0] : data
  return ok((row as MyKam) ?? null)
}
