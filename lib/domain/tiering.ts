import type { ReferralOrder } from './types'

/**
 * How Material Depot classifies a partner firm, and whether that firm has gone
 * quiet.
 *
 * ## Internal only
 *
 * Nothing in this file may be rendered in the partner app. Telling an architect
 * they are a "Basic User" is a way to lose them, and the classification exists
 * to decide where a KAM spends their week, not to grade anybody. Everything here
 * is imported by `components/console/**` and by nothing under `app/(app)/`.
 * There is a test for that in `npm run typecheck`'s blind spot, so it is stated
 * here instead: if you find yourself importing this from a partner-facing page,
 * that is the bug.
 *
 * ## Derived, never stored
 *
 * Both the tier and the engagement state are computed from `referral_order`
 * rows at read time, like every other total in this app. A stored "power user"
 * flag goes stale the moment an order syncs and then disagrees with the order
 * list on the same screen.
 */

export type UsageTier = 'power' | 'mid' | 'basic'

export const USAGE_TIER = {
  power: { label: 'Power', blurb: '5 or more orders', tone: 'good' },
  mid:   { label: 'Mid',   blurb: '2 to 4 orders',    tone: 'info' },
  basic: { label: 'Basic', blurb: '0 or 1 order',     tone: 'neutral' },
} as const

/** ≥5 → power, 2–4 → mid, 0–1 → basic. Counted in ORDERS, not rupees. */
export function usageTier(orderCount: number): UsageTier {
  if (orderCount >= 5) return 'power'
  if (orderCount >= 2) return 'mid'
  return 'basic'
}

/** A firm with no order in this many days needs reactivating. */
export const DORMANT_AFTER_DAYS = 90

export type Engagement = 'active' | 'dormant' | 'never_ordered'

export const ENGAGEMENT = {
  active:        { label: 'Active',          tone: 'good' },
  dormant:       { label: 'Needs a call',    tone: 'warn' },
  never_ordered: { label: 'No orders yet',   tone: 'neutral' },
} as const

export function daysSince(iso: string | null | undefined, now = new Date()): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  return Math.floor((now.getTime() - t) / 86400000)
}

/**
 * Three outcomes, not two. "Never ordered" is a different job from "used to
 * order and stopped" — the first is an onboarding that has not landed, the
 * second is a relationship going cold — and folding them together sends a KAM
 * into a reactivation call with a firm that has nothing to reactivate.
 */
export function engagement(
  lastOrderOn: string | null,
  now = new Date(),
): { state: Engagement; days: number | null } {
  const days = daysSince(lastOrderOn, now)
  if (days === null) return { state: 'never_ordered', days: null }
  return { state: days > DORMANT_AFTER_DAYS ? 'dormant' : 'active', days }
}

export type PartnerStanding = {
  orderCount: number
  approvedValue: number
  pendingCount: number
  pendingValue: number
  lastOrderOn: string | null
  tier: UsageTier
  engagement: Engagement
  daysSinceOrder: number | null
}

/**
 * Everything the console says about one firm's trading, from its order rows.
 *
 * Only APPROVED orders count towards the tier, the value and the last-order
 * date. An order waiting on an admin is reported separately (`pendingCount`),
 * because "this firm looks dormant" and "this firm has three orders nobody has
 * verified" are opposite problems with opposite actions.
 */
export function partnerStanding(orders: ReferralOrder[], now = new Date()): PartnerStanding {
  const approved = orders.filter((o) => o.approval_status === 'approved')
  const pending = orders.filter((o) => o.approval_status === 'pending')

  const dates = approved
    .map((o) => o.ordered_on ?? o.synced_at)
    .filter((d): d is string => Boolean(d))
    .sort()
  const lastOrderOn = dates.length ? dates[dates.length - 1] : null
  const { state, days } = engagement(lastOrderOn, now)

  return {
    orderCount: approved.length,
    approvedValue: approved.reduce((s, o) => s + (Number(o.order_value) || 0), 0),
    pendingCount: pending.length,
    pendingValue: pending.reduce((s, o) => s + (Number(o.order_value) || 0), 0),
    lastOrderOn,
    tier: usageTier(approved.length),
    engagement: state,
    daysSinceOrder: days,
  }
}
