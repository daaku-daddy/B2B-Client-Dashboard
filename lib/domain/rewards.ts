import type { ReferralOrder, RewardClaim, RewardTier } from './types'

/**
 * The incentive scheme, computed — never stored.
 *
 * Attributed sale is the sum of `referral_order.order_value` for every order a
 * partner's referred clients placed AND a Material Depot admin has verified.
 * `referral_order.md_enq_id` is unique, so re-running the sync cannot inflate
 * that total. A stored running total would
 * have two independent ways to go stale (a new order, a corrected order value),
 * and an architect who sees two different figures for their own progress stops
 * trusting the whole dashboard.
 *
 * Tiers are CUMULATIVE: crossing ₹5 L means tiers 1, 2 and 3 are all earned.
 * The brief lists them as milestones on one ladder, not as an either/or.
 */

/**
 * The only number the ladder is allowed to be computed from.
 *
 * `approval_status = 'approved'` and nothing else. A pending order is real
 * money that a real client really spent, and it is still not counted: an order
 * that turns out to belong to a different architect, or to be a duplicate, would
 * otherwise have already bought someone a gold coin by the time anyone noticed.
 * Everywhere this total is shown, the pending figure is shown beside it — see
 * `pendingSale()` — so a partner is never quietly short-changed without being
 * told why.
 */
export function attributedSale(orders: ReferralOrder[]): number {
  return orders
    .filter((o) => o.approval_status === 'approved')
    .reduce((s, o) => s + (Number(o.order_value) || 0), 0)
}

/** Placed, not yet verified. Shown beside the total, never added to it. */
export function pendingSale(orders: ReferralOrder[]): { count: number; value: number } {
  const pending = orders.filter((o) => o.approval_status === 'pending')
  return {
    count: pending.length,
    value: pending.reduce((s, o) => s + (Number(o.order_value) || 0), 0),
  }
}

export type TierProgress = {
  tier: RewardTier
  unlocked: boolean
  /** the handover state, when the tier is unlocked and a claim row exists */
  claim: RewardClaim | null
  /** 0–100, how far into THIS tier's band the partner is */
  progressPct: number
  /** rupees still needed to unlock it; 0 once unlocked */
  remaining: number
}

export type RewardStatus = {
  attributedSale: number
  tiers: TierProgress[]
  earned: TierProgress[]
  /** the next thing to chase, or null once everything is earned */
  next: TierProgress | null
  /** unlocked but not yet marked fulfilled */
  awaitingHandover: TierProgress[]
  fulfilled: TierProgress[]
  /** overall position on the whole ladder, 0–100 */
  ladderPct: number
}

export function rewardStatus(
  attributedSale: number,
  tiers: RewardTier[],
  claims: RewardClaim[],
): RewardStatus {
  const sorted = [...tiers].sort((a, b) => a.threshold - b.threshold)
  const claimBy = new Map(claims.map((c) => [c.tier_id, c]))
  const total = Math.max(0, attributedSale || 0)

  const rows: TierProgress[] = sorted.map((tier, i) => {
    const floor = i === 0 ? 0 : sorted[i - 1].threshold
    const band = tier.threshold - floor
    const unlocked = total >= tier.threshold
    const into = Math.min(Math.max(total - floor, 0), band)
    return {
      tier,
      unlocked,
      claim: claimBy.get(tier.id) ?? null,
      progressPct: band > 0 ? Math.round((into / band) * 100) : unlocked ? 100 : 0,
      remaining: unlocked ? 0 : Math.round(tier.threshold - total),
    }
  })

  const earned = rows.filter((r) => r.unlocked)
  const top = sorted.length ? sorted[sorted.length - 1].threshold : 0
  return {
    attributedSale: total,
    tiers: rows,
    earned,
    next: rows.find((r) => !r.unlocked) ?? null,
    awaitingHandover: earned.filter((r) => r.claim?.status !== 'fulfilled'),
    fulfilled: earned.filter((r) => r.claim?.status === 'fulfilled'),
    ladderPct: top > 0 ? Math.min(100, Math.round((total / top) * 100)) : 0,
  }
}

export const TIER_ICON: Record<RewardTier['kind'], string> = {
  silver: '🥈',
  gold: '🥇',
  trip: '✈️',
}
