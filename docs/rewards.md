# Rewards

**Covers:** `lib/domain/rewards.ts · components/rewards/RewardTrack.tsx · reward_tier · reward_claim`

## The ladder

| # | Sales to referred clients | Reward |
|---|---|---|
| 1 | ₹1,00,000 | 10 GM silver coin |
| 2 | ₹2,00,000 | 30 GM silver coin |
| 3 | ₹5,00,000 | 1 GM 24K gold coin |
| 4 | ₹10,00,000 | 3 GM 24K gold coin |
| 5 | ₹25,00,000 | Thailand trip for 2 |
| 6 | ₹50,00,000 | Europe trip for 2 |

Seeded in `001_init.sql` and **config, not code** — the scheme can be changed in
the SQL Editor without a deploy. `reward_tier.active` retires a tier without
deleting the claims against it.

## Cumulative, and derived

Tiers are **cumulative**: crossing ₹5 L means tiers 1, 2 and 3 are all earned.
The brief lists them as milestones on one ladder, not as an either/or.

Attributed sale is `SUM(referral_order.order_value)` across the partner's
referrals **where `approval_status = 'approved'`**, computed at read time.
`attributedSale()` in `lib/domain/rewards.ts` is the only function allowed to
total it, and `pendingSale()` reports what is waiting on an admin so the two are
never added together by accident. `docs/referrals.md` has why the gate exists. Nothing stores a running total, because a
stored total has two independent ways to go stale — a new order, and a corrected
order value — and an architect who sees two different figures for their own
progress stops trusting the whole dashboard.

`reward_claim` records that a tier was reached and whether it has been handed
over (`unlocked` → `claimed` → `fulfilled`). It is **not** the source of truth
for whether a tier is unlocked; `rewardStatus()` derives that from the orders
every time.

## "Payout till date" and "payout remaining"

The brief asks for those. In this scheme the rewards are physical, so there is
no rupee payout to total, and inventing one would be a number with no
counterpart in reality. Instead:

- **earned** — tiers whose threshold has been crossed
- **awaiting handover** — earned, `status !== 'fulfilled'`
- **received** — `status = 'fulfilled'`, with the date

If a cash component is ever added to the scheme, it belongs as a column on
`reward_tier` and a fourth figure here — not as a re-interpretation of the
coins.

## The gamified surface

`RewardTrack` puts the **next** milestone at the top and loudest: the rupees
still needed, a progress bar for that tier's band only (not the whole ladder),
and "N of 6 earned". Locked tiers are desaturated; earned ones are green with
their handover state. `ladderPct` is the whole-ladder position, used sparingly —
a partner at ₹1 L is 2% along the ladder and 100% through tier 1, and the second
is the motivating number.
