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
import { cartState, readCart, summariseClients } from '../lib/domain/referrals.ts'
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

console.log('\n"All earned" and "there is no ladder" are different answers')
{
  const tier = (id: number, threshold: number) =>
    ({ id, threshold, label: `T${id}`, kind: 'silver', detail: null, active: true }) as any
  const none = rewardStatus(500000, [], [])
  t('an empty ladder is not a completed one', () => {
    assert.equal(none.next, null)
    assert.equal(none.complete, false)
  })
  const done = rewardStatus(500000, [tier(1, 100000), tier(2, 250000)], [])
  t('clearing every tier is', () => {
    assert.equal(done.next, null)
    assert.equal(done.complete, true)
  })
  const mid = rewardStatus(150000, [tier(1, 100000), tier(2, 250000)], [])
  t('and a ladder with something left to chase is neither', () => {
    assert.equal(mid.next?.tier.id, 2)
    assert.equal(mid.complete, false)
  })
}

console.log('\nCarts, which the sync does not send a state for')
const ev = (e: Partial<any>) => ({
  id: String(Math.random()), referral_id: 'r1', event_type: 'other', occurred_at: '2026-09-01T10:00:00Z',
  store: null, title: null, detail: null, amount: null, payload: {},
  external_id: String(Math.random()), synced_at: '2026-09-01T00:00:00Z',
  ...e,
}) as any

const countCart = ev({
  event_type: 'cart_add', occurred_at: '2026-09-02T10:00:00Z', store: 'Indiranagar',
  title: 'Cart created - 3 items', detail: 'Oak plank, arctic white laminate, quartz.',
  amount: 78400, payload: { items: 3 },
})
t('{"items": 3} is a count, and the prose is the contents', () => {
  const c = readCart(countCart)
  assert.equal(c.itemCount, 3)
  assert.equal(c.value, 78400)
  assert.deepEqual(c.lines, [])
  assert.equal(c.summary, 'Oak plank, arctic white laminate, quartz.')
})

const listCart = ev({
  event_type: 'cart_add', occurred_at: '2026-09-02T10:00:00Z', amount: 78400,
  detail: 'Oak plank, laminate, quartz.',
  payload: { items: [
    { name: 'Engineered Oak Plank 14mm', sku: 'WF 4402', qty: 420, unit: 'sqft', rate: 142 },
    { sku: 'LM 3301' },
    { qty: 2 },
  ] },
})
t('an itemised payload becomes lines, and the prose is dropped as a duplicate', () => {
  const c = readCart(listCart)
  assert.equal(c.itemCount, 3)
  assert.equal(c.lines.length, 3)
  assert.equal(c.summary, null)
  assert.equal(c.lines[0].qty, 420)
  assert.equal(c.lines[0].unit, 'sqft')
})
t('an item with no name is still an item — the count cannot understate the cart', () => {
  const c = readCart(listCart)
  assert.equal(c.lines[1].label, 'LM 3301')
  assert.equal(c.lines[2].label, 'Item')
  assert.equal(c.itemCount, 3)
})

t('a cart with nothing after it is open', () => {
  const st = cartState([countCart])
  assert.equal(st.state, 'open')
})
t('an order after it closes it', () => {
  const st = cartState([countCart, ev({ event_type: 'order_placed', occurred_at: '2026-09-03T10:00:00Z' })])
  assert.equal(st.state, 'ordered')
})
t('an order BEFORE it does not — that is a second cart being built', () => {
  const st = cartState([countCart, ev({ event_type: 'order_placed', occurred_at: '2026-09-01T10:00:00Z' })])
  assert.equal(st.state, 'open')
})
t('no cart at all is its own answer, not an empty one', () => {
  assert.equal(cartState([ev({ event_type: 'store_visit' })]).state, 'none')
})
t('the newest cart is the one that counts', () => {
  const st = cartState([
    ev({ event_type: 'cart_add', occurred_at: '2026-08-01T10:00:00Z', amount: 1000, payload: { items: 1 } }),
    ev({ event_type: 'cart_add', occurred_at: '2026-09-05T10:00:00Z', amount: 5000, payload: { items: 9 } }),
    ev({ event_type: 'order_placed', occurred_at: '2026-08-02T10:00:00Z' }),
  ])
  assert.equal(st.state, 'open')
  assert.equal(st.state === 'open' ? st.cart.value : null, 5000)
})
t('offsets are compared as instants, not as text', () => {
  // 23:30 +05:30 is 18:00Z. As strings, "2026-09-09T23:30:00+05:30" sorts
  // AFTER "2026-09-09T19:00:00+00:00" — which would leave a cart looking open
  // an hour after the order that closed it.
  const st = cartState([
    ev({ event_type: 'cart_add', occurred_at: '2026-09-09T23:30:00+05:30', amount: 1000, payload: { items: 2 } }),
    ev({ event_type: 'order_placed', occurred_at: '2026-09-09T19:00:00+00:00' }),
  ])
  assert.equal(st.state, 'ordered')
})
t('an order row with no matching event still closes the cart', () => {
  // The sync takes events and orders as two independent arrays, and a producer
  // may push only the order. Left to the event stream, this client would look
  // like an open cart to chase for ever.
  const st = cartState(
    [countCart],
    [order({ referral_id: 'r1', order_value: 78400, ordered_on: '2026-09-04' })],
  )
  assert.equal(st.state, 'ordered')
})
t('an order row DATED the cart day closes it — that is carting then buying in store', () => {
  const st = cartState([countCart], [order({ ordered_on: '2026-09-02' })])
  assert.equal(st.state, 'ordered')
})
t('an order row from before the cart leaves it open', () => {
  const st = cartState([countCart], [order({ ordered_on: '2026-09-01' })])
  assert.equal(st.state, 'open')
})
t('an order with no date cannot close anything', () => {
  const st = cartState([countCart], [order({ ordered_on: null })])
  assert.equal(st.state, 'open')
})
t('a pending order still means they bought — approval is about paying the architect', () => {
  const st = cartState([countCart], [order({ ordered_on: '2026-09-05', approval_status: 'pending' })])
  assert.equal(st.state, 'ordered')
})
t('a producer that knows the cart is still open overrules the guess', () => {
  const st = cartState([
    ev({ event_type: 'cart_add', occurred_at: '2026-09-02T10:00:00Z', payload: { items: 2, cart_status: 'open' } }),
    ev({ event_type: 'order_placed', occurred_at: '2026-09-03T10:00:00Z' }),
  ])
  assert.equal(st.state, 'open')
})

console.log('\nOne row per referred client')
const ref = (id: string, name: string, on: string) =>
  ({ id, partner_id: 'p', client_id: null, project_id: null, client_name: name,
     md_phone: '9800000000', referred_on: on, notes: null, created_at: on }) as any

const rows = summariseClients(
  [ref('r1', 'Rao', '2026-08-01'), ref('r2', 'Iyer', '2026-08-20'), ref('r3', 'Prakash', '2026-05-01')],
  [
    ev({ referral_id: 'r1', event_type: 'store_visit', occurred_at: '2026-09-02T09:00:00Z', store: 'Indiranagar' }),
    ev({ referral_id: 'r1', event_type: 'cart_add', occurred_at: '2026-09-02T10:00:00Z', amount: 78400, payload: { items: 3 } }),
    ev({ referral_id: 'r2', event_type: 'store_visit', occurred_at: '2026-09-09T09:00:00Z', store: 'Jayanagar' }),
  ],
  [
    order({ referral_id: 'r1', order_value: 100000, approval_status: 'approved' }),
    order({ referral_id: 'r1', order_value: 250000, approval_status: 'pending' }),
    order({ referral_id: 'r2', order_value: 999999, approval_status: 'approved' }),
  ],
)
t('most recently active first', () => assert.deepEqual(rows.map((r) => r.referral.id), ['r2', 'r1', 'r3']))
t('a client who has done nothing still gets a row', () => {
  const quiet = rows.find((r) => r.referral.id === 'r3')!
  assert.equal(quiet.lastSeen, null)
  assert.equal(quiet.cart.state, 'none')
  assert.equal(quiet.approved, 0)
})
t('one client never picks up another client\'s events or orders', () => {
  const rao = rows.find((r) => r.referral.id === 'r1')!
  assert.equal(rao.events.length, 2)
  assert.equal(rao.orders.length, 2)
  assert.equal(rao.stores.join(), 'Indiranagar')
})
t('per-client money is the ladder\'s arithmetic — approved only, pending beside it', () => {
  const rao = rows.find((r) => r.referral.id === 'r1')!
  assert.equal(rao.approved, 100000)
  assert.equal(rao.pending, 250000)
  assert.equal(rao.pendingCount, 1)
})
t('and the per-client totals add up to the figure on the ladder', () => {
  const all = [
    order({ referral_id: 'r1', order_value: 100000, approval_status: 'approved' }),
    order({ referral_id: 'r1', order_value: 250000, approval_status: 'pending' }),
    order({ referral_id: 'r2', order_value: 999999, approval_status: 'approved' }),
  ]
  assert.equal(rows.reduce((s, r) => s + r.approved, 0), attributedSale(all))
})
t('an open cart is carried on the row, with its value', () => {
  const rao = rows.find((r) => r.referral.id === 'r1')!
  assert.equal(rao.cart.state, 'open')
  assert.equal(rao.cart.state === 'open' ? rao.cart.cart.value : null, 78400)
})

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
