/**
 * The pure domain rules, run directly — no bundler, no database, no browser.
 *
 *     npm run test:domain
 *
 * `tsc` and `next build` passing is not evidence any of this is right: every one
 * of the six bugs in docs/landmines.md compiled. These are the rules where being
 * off by one costs somebody a gold coin or puts a firm on the wrong call list,
 * so they are asserted at their boundaries rather than eyeballed.
 */
import assert from 'node:assert/strict'
import { partnerStanding, usageTier, engagement } from '../lib/domain/tiering.ts'
import { attributedSale, pendingSale, rewardStatus } from '../lib/domain/rewards.ts'
import { guessMarket, marketLabel } from '../lib/domain/markets.ts'
import { generatePassword } from '../lib/auth/credentials.ts'

let n = 0
const t = (name: string, fn: () => void) => { fn(); n++; console.log('  PASS ', name) }

const order = (o: Partial<any>) => ({
  id: String(Math.random()), referral_id: 'r', md_enq_id: 'E', order_value: 0,
  ordered_on: null, store: null, status: null, approval_status: 'approved',
  approved_by: null, approved_at: null, review_note: null, synced_at: '2026-09-01T00:00:00Z',
  ...o,
}) as any

console.log('\nThe boundaries of the classification (the brief is explicit about these)')
t('0 orders is Basic', () => assert.equal(usageTier(0), 'basic'))
t('1 order is Basic', () => assert.equal(usageTier(1), 'basic'))
t('2 is Mid', () => assert.equal(usageTier(2), 'mid'))
t('4 is Mid', () => assert.equal(usageTier(4), 'mid'))
t('5 is Power — "more than or EQUAL to 5"', () => assert.equal(usageTier(5), 'power'))
t('9 is Power', () => assert.equal(usageTier(9), 'power'))

console.log('\nThree months, and three engagement outcomes')
const now = new Date('2026-09-15T00:00:00Z')
t('never ordered is its own answer, not "dormant"', () =>
  assert.deepEqual(engagement(null, now), { state: 'never_ordered', days: null }))
t('89 days is still active', () =>
  assert.equal(engagement('2026-06-18T00:00:00Z', now).state, 'active'))
t('exactly 90 days is still active', () =>
  assert.equal(engagement('2026-06-17T00:00:00Z', now).state, 'active'))
t('91 days needs a call', () =>
  assert.equal(engagement('2026-06-16T00:00:00Z', now).state, 'dormant'))

console.log('\nOnly verified orders count')
const mixed = [
  order({ order_value: 100000, approval_status: 'approved', ordered_on: '2026-09-01' }),
  order({ order_value: 250000, approval_status: 'pending',  ordered_on: '2026-09-10' }),
  order({ order_value: 999999, approval_status: 'rejected', ordered_on: '2026-09-12' }),
]
t('attributedSale ignores pending and rejected', () => assert.equal(attributedSale(mixed), 100000))
t('pendingSale reports the pending one only', () =>
  assert.deepEqual(pendingSale(mixed), { count: 1, value: 250000 }))
t('a rejected order is in neither figure', () =>
  assert.equal(attributedSale(mixed) + pendingSale(mixed).value, 350000))

console.log('\npartnerStanding')
const s = partnerStanding(mixed, now)
t('counts only approved orders towards the tier', () => assert.equal(s.orderCount, 1))
t('...so three orders is still Basic', () => assert.equal(s.tier, 'basic'))
t('last order date ignores the pending one', () => assert.equal(s.lastOrderOn, '2026-09-01'))
t('a firm with only a PENDING order reads as never_ordered, not active', () => {
  const only = partnerStanding([order({ order_value: 5, approval_status: 'pending', ordered_on: '2026-09-14' })], now)
  assert.equal(only.engagement, 'never_ordered')
  assert.equal(only.pendingCount, 1)
})
t('no orders at all is safe', () => {
  const none = partnerStanding([], now)
  assert.deepEqual(
    [none.orderCount, none.approvedValue, none.tier, none.engagement, none.lastOrderOn],
    [0, 0, 'basic', 'never_ordered', null],
  )
})
t('falls back to synced_at when ordered_on is missing', () => {
  const r = partnerStanding([order({ order_value: 1, ordered_on: null, synced_at: '2026-09-14T10:00:00Z' })], now)
  assert.equal(r.engagement, 'active')
})

console.log('\nThe ladder still works off the approved figure')
const tiers = [
  { id: 1, threshold: 100000, label: 'Silver', kind: 'silver', detail: null, active: true },
  { id: 2, threshold: 500000, label: 'Gold',   kind: 'gold',   detail: null, active: true },
] as any[]
t('a pending order does not unlock a tier', () => {
  const st = rewardStatus(attributedSale(mixed), tiers, [])
  assert.equal(st.earned.length, 1)
  assert.equal(st.next?.tier.id, 2)
  assert.equal(st.next?.remaining, 400000)
})
t('approving it would', () => {
  const approvedAll = mixed.map((o: any) => ({ ...o, approval_status: 'approved' }))
  assert.equal(rewardStatus(attributedSale(approvedAll), tiers, []).earned.length, 2)
})

console.log('\nMarkets')
t('Bengaluru and Bangalore land on one key', () =>
  assert.equal(guessMarket('Bengaluru'), guessMarket('Bangalore')))
t('Secunderabad is Hyderabad', () => assert.equal(guessMarket('Secunderabad'), 'hyderabad'))
t('an unknown city is null, not a nearest match', () => assert.equal(guessMarket('Kochi'), null))
t('a blank city is null', () => assert.equal(guessMarket(''), null))
t('a null market reads as every market', () => assert.equal(marketLabel(null), 'All markets'))
t('an unknown market key is shown as itself rather than swallowed', () =>
  assert.equal(marketLabel('chennai'), 'chennai'))

console.log('\nOne-time passwords')
t('no characters that can be misread aloud', () => {
  for (let i = 0; i < 400; i++) assert.ok(!/[Il1O0]/.test(generatePassword()))
})
t('long enough, and 1000 in a row are all different', () => {
  const seen = new Set<string>()
  for (let i = 0; i < 1000; i++) {
    const p = generatePassword()
    assert.ok(p.replace(/-/g, '').length >= 12)
    seen.add(p)
  }
  assert.equal(seen.size, 1000)
})

console.log(`\n${n} passed, 0 failed`)
