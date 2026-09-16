/**
 * The incentive programme, as approved — Studio Sales Dashboard PRD v1.1 §10.
 *
 * TWO programmes run in parallel on the same attributed-spend base: a MONTHLY
 * slab (cashback + gift) and a QUARTERLY slab (experiential rewards). They are
 * additive, not exclusive.
 *
 * ## Why this is code and not a table
 *
 * `reward_tier` is config in Postgres because it is one number per row. A slab
 * is eight numbers, a milestone and a version, and §10.5.6 requires that a
 * partner sees *the version that applied to their accrual period* — a mutable
 * config row cannot answer "what was the rate in August" after somebody edits
 * it. So the ladder is versioned source, and changing it is a commit with a new
 * `effective_from`, which is exactly the audit trail the money needs.
 *
 * ## What is derived, and what is published
 *
 * Only `floor`, `ceiling`, the four percentages and the milestone are entered.
 * Every rupee figure in the PRD's tables — retail max, store max, cashback max,
 * net cashback, gift value, max total advantage — is DERIVED here and asserted
 * against the published figures in `test/domain.test.ts`. The published table is
 * internally consistent to the rupee; encoding the rupees as well would have
 * given two places for them to disagree.
 *
 * The one rule that is not a percentage of spend:
 *
 *   Gift value is a FIXED rupee amount per slab, derived from the slab floor —
 *   not a percentage of actual spend. ₹2,10,000 in a month earns the same
 *   ₹5,000 gift as ₹4,90,000 does. (§10.2)
 *
 * Cashback is the opposite: a rate applied to ACTUAL spend. The rupee figures in
 * the PRD are the ceilings at the top of each band.
 */

export type Milestone = 'multi_gift' | 'silver_coin' | 'gold_coin'

export type SlabInput = {
  id: number
  /** inclusive, in rupees — ₹50,001 in the PRD's "₹50,001 – ₹1,00,000" */
  floor: number
  /** inclusive; `null` on an open-ended top band */
  ceiling: number | null
  retailPct: number
  storePct: number
  cashbackPct: number
  /** applied to the slab's ROUND floor (`floor - 1`), never to actual spend */
  giftPct: number
  milestone: Milestone | null
  /** what the partner is actually given, in words */
  reward: string
}

export type Slab = SlabInput & {
  /** the round number the band starts from: ₹1,00,000 for the ₹1,00,001 band */
  base: number
  /** fixed, per §10.2 — `giftPct` × `base` */
  giftValue: number
  /** what a partner at the very top of this band could realise, per component */
  retailMax: number | null
  storeMax: number | null
  cashbackMax: number | null
  netCashbackMax: number | null
  /** retail + store + net cashback + gift, at the ceiling */
  maxAdvantage: number | null
  maxAdvantagePct: number | null
  /** `₹2,00,001 – ₹5,00,000`, or `Above ₹75,00,000` */
  bandLabel: string
}

/** The programme version these tables are. Stamped onto every ledger entry. */
export const PROGRAMME_VERSION = 'v1.1'

const MONTHLY_INPUT: SlabInput[] = [
  { id: 1, floor: 50_001, ceiling: 1_00_000, retailPct: 1.0, storePct: 0.75, cashbackPct: 1.0, giftPct: 0, milestone: null, reward: 'Cashback only' },
  { id: 2, floor: 1_00_001, ceiling: 2_00_000, retailPct: 2.0, storePct: 1.0, cashbackPct: 2.0, giftPct: 2.0, milestone: 'multi_gift', reward: 'Cashback + gift' },
  { id: 3, floor: 2_00_001, ceiling: 5_00_000, retailPct: 2.0, storePct: 2.0, cashbackPct: 3.0, giftPct: 2.5, milestone: 'silver_coin', reward: 'Cashback + Silver Coin' },
  { id: 4, floor: 5_00_001, ceiling: 7_50_000, retailPct: 5.0, storePct: 2.0, cashbackPct: 4.0, giftPct: 3.0, milestone: 'gold_coin', reward: 'Cashback + Gold Coin' },
  { id: 5, floor: 7_50_001, ceiling: 10_00_000, retailPct: 5.0, storePct: 3.0, cashbackPct: 5.0, giftPct: 3.5, milestone: 'gold_coin', reward: 'Cashback + Gold Coin' },
]

const QUARTERLY_INPUT: SlabInput[] = [
  { id: 1, floor: 25_00_001, ceiling: 50_00_000, retailPct: 0, storePct: 0, cashbackPct: 0, giftPct: 1.0, milestone: null, reward: 'Hotel / stay vouchers' },
  { id: 2, floor: 50_00_001, ceiling: 75_00_000, retailPct: 0, storePct: 0, cashbackPct: 0, giftPct: 2.0, milestone: null, reward: 'Domestic trip' },
  { id: 3, floor: 75_00_001, ceiling: null, retailPct: 0, storePct: 0, cashbackPct: 0, giftPct: 4.0, milestone: null, reward: 'International trip' },
]

/**
 * §10.3's first band reads "₹25,00,000 – ₹50,00,000" where the monthly table
 * reads "₹50,001 – ₹1,00,000". Taken literally the quarterly bands would
 * overlap at their edges, so they are normalised the monthly way — a floor of
 * ₹25,00,001 against a round base of ₹25,00,000, which is also the figure the
 * published 1% · ₹25,000 gift is derived from.
 */
function build(input: SlabInput): Slab {
  const base = input.floor - 1
  const c = input.ceiling
  const at = (pct: number) => (c === null ? null : round(c * (pct / 100)))
  const netPct = input.cashbackPct - input.storePct
  const giftValue = round(base * (input.giftPct / 100))
  const retailMax = at(input.retailPct)
  const storeMax = at(input.storePct)
  const netCashbackMax = at(netPct)
  const maxAdvantage =
    retailMax === null || storeMax === null || netCashbackMax === null
      ? null
      : retailMax + storeMax + netCashbackMax + giftValue
  return {
    ...input,
    base,
    giftValue,
    retailMax,
    storeMax,
    cashbackMax: at(input.cashbackPct),
    netCashbackMax,
    maxAdvantage,
    maxAdvantagePct: maxAdvantage !== null && c ? round2((maxAdvantage / c) * 100) : null,
    bandLabel: c === null ? `Above ${short(base)}` : `${short(input.floor)} – ${short(c)}`,
  }
}

export const MONTHLY_SLABS: Slab[] = MONTHLY_INPUT.map(build)
export const QUARTERLY_SLABS: Slab[] = QUARTERLY_INPUT.map(build)

/** Nothing is earned below this in a calendar month. §10.2 is explicit that the
 *  dashboard must say so plainly rather than render an empty tab. */
export const MONTHLY_ENTRY = MONTHLY_SLABS[0].floor
export const QUARTERLY_ENTRY = QUARTERLY_SLABS[0].floor

export function slabsFor(kind: 'month' | 'quarter'): Slab[] {
  return kind === 'month' ? MONTHLY_SLABS : QUARTERLY_SLABS
}

/**
 * Where a spend figure lands on a ladder.
 *
 * FOUR outcomes, not two, and the fourth is the one that matters:
 *
 * - `below` — under the entry threshold. Earns nothing, and says so.
 * - `in` — inside a published band.
 * - `above` — past the top published band. **§17 decision 4 is open**: monthly
 *   slabs above ₹10,00,000 have no rates or gift values yet. Applying the top
 *   slab's rate to ₹14 L would be inventing a payout, and paying the top slab's
 *   ceiling figure would be short-changing the best partner on the platform. So
 *   this reports the position and refuses to compute, and the screen says the
 *   rate is being confirmed. The quarterly ladder's top band IS open-ended, so
 *   this never happens there.
 * - `empty` — the ladder itself is missing. Cannot happen with these constants,
 *   handled because a ladder read as empty once rendered as "all earned".
 */
export type SlabPosition =
  | { kind: 'below'; slab: null; next: Slab; gap: number }
  | { kind: 'in'; slab: Slab; next: Slab | null; gap: number }
  | { kind: 'above'; slab: Slab; next: null; gap: 0 }
  | { kind: 'empty'; slab: null; next: null; gap: 0 }

export function positionIn(spend: number, ladder: Slab[]): SlabPosition {
  if (!ladder.length) return { kind: 'empty', slab: null, next: null, gap: 0 }
  const total = Math.max(0, spend || 0)
  const sorted = [...ladder].sort((a, b) => a.floor - b.floor)

  if (total < sorted[0].floor) {
    return { kind: 'below', slab: null, next: sorted[0], gap: sorted[0].floor - total }
  }
  const idx = sorted.findIndex((s) => s.ceiling === null || total <= s.ceiling)
  if (idx === -1) {
    // Past the top band and the top band is closed — §17 decision 4.
    return { kind: 'above', slab: sorted[sorted.length - 1], next: null, gap: 0 }
  }
  const next = sorted[idx + 1] ?? null
  return { kind: 'in', slab: sorted[idx], next, gap: next ? next.floor - total : 0 }
}

export const monthlyPosition = (spend: number) => positionIn(spend, MONTHLY_SLABS)
export const quarterlyPosition = (spend: number) => positionIn(spend, QUARTERLY_SLABS)

// ------------------------------------------------------------------ cashback

/**
 * The governing formula (§10.1), and the one place it is allowed to live:
 *
 *     Net cashback = (slab cashback rate × qualifying spend)
 *                  −  store discount already availed on those orders
 *
 * With two rules that cost money if they are missed:
 *
 * 1. **It floors at zero** (§10.4). If the discounts a client actually took at
 *    the till exceed the cashback due, the partner owes nothing back.
 *
 * 2. **A missing discount is not a zero discount.** §10.4 calls per-order coupon
 *    capture a hard Phase 1 dependency and §18 says the fallback is "gross
 *    cashback with explicit Business sign-off, never a silent approximation".
 *    Treating an unknown discount as ₹0 would quietly overstate every partner's
 *    net cashback and is precisely the silent approximation that was ruled out.
 *    So `discountKnown` is a third state carried out of here, and the screen
 *    labels a gross figure as gross.
 */
export type Cashback = {
  slab: Slab | null
  spend: number
  /** rate × spend, before any deduction */
  gross: number
  /** what was actually availed at the till, across the orders that are known */
  discountAvailed: number
  /** gross − discount, floored at zero. `null` when the discount is unknown. */
  net: number | null
  /** every order in the period carried its coupon and discount data */
  discountKnown: boolean
  /** how many of the period's orders did not */
  ordersMissingDiscount: number
  giftValue: number
  milestone: Milestone | null
  /** the top band is open (§17 d.4) — no rate to apply */
  rateUnpublished: boolean
}

export function cashbackFor(
  spend: number,
  ladder: Slab[],
  discount: { availed: number; ordersMissing: number },
): Cashback {
  const pos = positionIn(spend, ladder)
  const slab = pos.slab
  const known = discount.ordersMissing === 0
  const rateUnpublished = pos.kind === 'above'

  if (!slab || rateUnpublished) {
    return {
      slab,
      spend,
      gross: 0,
      discountAvailed: discount.availed,
      net: rateUnpublished ? null : 0,
      discountKnown: known,
      ordersMissingDiscount: discount.ordersMissing,
      giftValue: rateUnpublished ? 0 : 0,
      milestone: null,
      rateUnpublished,
    }
  }

  const gross = round(spend * (slab.cashbackPct / 100))
  return {
    slab,
    spend,
    gross,
    discountAvailed: discount.availed,
    net: known ? Math.max(0, gross - discount.availed) : null,
    discountKnown: known,
    ordersMissingDiscount: discount.ordersMissing,
    giftValue: slab.giftValue,
    milestone: slab.milestone,
    rateUnpublished,
  }
}

// ------------------------------------------------------------------- helpers

function round(n: number) {
  return Math.round(n)
}
function round2(n: number) {
  return Math.round(n * 100) / 100
}

/** `₹2,00,001` — Indian grouping, no decimals. Kept local so the slab tables
 *  read the way the PRD prints them without importing the UI formatter. */
function short(n: number) {
  return `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n)}`
}

export const MILESTONE_LABEL: Record<Milestone, string> = {
  multi_gift: 'Unlocks multiple gifts',
  silver_coin: 'Silver Coin',
  gold_coin: 'Gold Coin',
}

/**
 * The same milestone inside a sentence, article included.
 *
 * `MILESTONE_LABEL` is a noun for a chip; dropping it into "…and the ${label}"
 * produced "and the Unlocks multiple gifts" on screen. Two maps rather than one
 * clever join, because English articles are not derivable.
 */
export const MILESTONE_PHRASE: Record<Milestone, string> = {
  multi_gift: 'a gift on top',
  silver_coin: 'the Silver Coin',
  gold_coin: 'the Gold Coin',
}

export const MILESTONE_ICON: Record<Milestone, string> = {
  multi_gift: '🎁',
  silver_coin: '🥈',
  gold_coin: '🥇',
}
