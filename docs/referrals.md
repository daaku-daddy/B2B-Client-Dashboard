# Referrals

**Covers:** `components/referrals/** · app/api/sync/referrals/route.ts · referral · referral_event · referral_order`

## The screen: one row per client, the log behind the name

The partner's home page opens with the **list of clients they referred** — not a
merged stream of every event from all of them. The stream was the first cut and
it was the wrong unit. Four clients' visits, views and orders interleaved
newest-first is the shape a log file has; the question an architect actually has
is per person, and the answer to "how is the Rao job going" was scattered down
six rows of somebody else's activity.

So: `ClientActivity` renders the list (name, where and when they were last seen,
what is in their cart, what has counted) and swaps to that one client's timeline
when a name is tapped. `/referrals?client=<referral id>` opens the same client on
the full record page, which is what the list links to.

Inside, each event is **a chip and a value**, not a sentence: the store for a
visit, the product for a view, the size and value of a cart, the enquiry id for
an order. The prose — `title`, `detail`, the whole free-form `payload` — is one
tap away on the row somebody cares about. That is `ReferralFeed`, and it is the
same component on the client page and in the console mirror.

### The cart is the point of the screen

A referred client with things in a cart and no order is the one row worth acting
on today, so it is a chip on the list and the first panel inside — item count,
what is in it, and what it is worth.

`referral_event` has no cart state. It is an append-only log, so "is this cart
still open" is **derived**, in `cartState()` (`lib/domain/referrals.ts`):

- The newest `cart_add` is the cart. Older ones are history.
- It is closed by an `order_placed` **event** at or after it (compared as
  instants — `+05:30` and `+00:00` both arrive, and string ordering would put a
  cart after the order that closed it), or by a `referral_order` **row** whose
  `ordered_on` falls on the cart's day or later. Both signals are read because
  the sync takes `events` and `orders` as independent arrays: a producer that
  pushes only the order row would otherwise leave a bought-out cart looking open
  for ever, and the architect would ring a client who had already bought.
  `ordered_on` is a date, so that half of the rule is day-granular, and it counts
  a `pending` order — approval decides who gets paid, not whether the client
  bought.
- A producer that knows better can say so: `payload.cart_status` of `open` or
  `ordered` wins outright.

Open, ordered and *never had a cart* are three states, not two. The UI says which
one it is looking at ("Still open", "Ordered", "Nothing in a cart") rather than
asserting "active cart" as something Material Depot told us.

### The cart payload, for whoever builds the producer

`payload` on a `cart_add` is free-form and two shapes are read:

```jsonc
"payload": { "items": 3 }                        // just a count
"payload": { "items": [                          // itemised — prefer this
  { "name": "Engineered Oak Plank 14mm", "sku": "WF 4402",
    "qty": 420, "unit": "sqft", "rate": 142 }
], "cart_status": "open" }
```

`event.amount` is the cart's value. With an itemised list the panel shows the
lines; with a count it falls back to `detail` as prose. An item the payload does
not name is still counted — dropping it would understate a cart the architect is
about to ring their client about.

## What this promises the architect

> Client X visited the Whitefield store on 9 September at 1pm. Here is what they
> looked at, what is in their cart, and what they ordered.

That data does not live in this app's database. It lives across **three other
systems**, none of them reachable from a partner's browser:

| System | Holds |
|---|---|
| Django `api.materialdepot.com/apiV1`, `/crm/leads/` | the authoritative cart, quote and order state |
| Kylas | the CRM's fourth backend; lead and appointment records |
| The field-ops Supabase (`jqrdfnjfxqxrazfkaofm`) | store visits and site activity logged by staff apps |

## So the sync is a push, and it is the contract

`POST /api/sync/referrals`, authenticated with `x-sync-key: $SYNC_SHARED_SECRET`,
using the service-role key to write tables partners can only read.

```jsonc
{
  "events": [{
    "phone": "9876543210",          // 10 digits; the ONLY join key
    "external_id": "visit:88421",   // unique; the dedupe key
    "event_type": "store_visit",    // store_visit | product_view | cart_add |
                                    //  quote_shared | order_placed | call | other
    "occurred_at": "2026-09-09T13:00:00+05:30",
    "store": "Whitefield",
    "title": "Walk-in",
    "detail": "Looked at large-format marble",
    "amount": null,
    "payload": {}
  }],
  "orders": [{
    "phone": "9876543210",
    "md_enq_id": "ENQ2026090912345",  // unique; makes the total idempotent
    "order_value": 184500,
    "ordered_on": "2026-09-09",
    "store": "Whitefield",
    "status": "Order Placed"
  }]
}
```

### Two properties this route must never lose

**1. Idempotent.** Every write is an upsert on `external_id` / `md_enq_id`, both
`UNIQUE`. Material Depot's field apps log one real event several times — a single
store arrival has been seen logged twenty times — and "visited 20 times on the
9th" is a number an architect would read and believe.

**2. A partial payload must not erase what is already there.** Rows are built
by `defined()`, which drops keys the caller did not send, so an upsert carrying
only `md_enq_id` and `order_value` leaves the store and the date alone. Writing
`store: o.store ?? null` instead looks harmless and is not: it blanks the
column on every re-sync. Found against production on 2026-09-11 by re-posting a
seeded order, which promptly lost its store and `ordered_on`. An explicit
`null` is still honoured — that is how a caller says "clear this".

**3. Exact phone matching, three outcomes.** A row matches one referral, matches
none, or matches **more than one** (two architects both claiming the same
client). The third is reported as `ambiguous` and skipped, never resolved by a
heuristic: attributing an order to the wrong architect pays the wrong person.

Every skip comes back in the response, with a reason
(`no_match` / `ambiguous` / `bad_phone` / `bad_row`). A sync that quietly dropped
forty orders because nobody had referred those phones is the failure that
reporting exists to prevent.

### An order arrives PENDING and counts towards nothing

`referral_order.approval_status` defaults to `pending`. A Material Depot admin
verifies each one in `/console/approvals`, and only an `approved` order is in
the figure the reward ladder is computed from — `attributedSale()` in
`lib/domain/rewards.ts` filters on it and is the only function allowed to total
that money.

Money is handed over on the strength of that number, so it gets a human. An order
attributed to the wrong architect, or a duplicate, would otherwise have already
bought somebody a gold coin by the time anyone noticed — and a `reward_claim` row,
once written, is never deleted.

The upsert here deliberately does **not** carry `approval_status`. An absent
column is left alone on an existing row, so a nightly re-sync can neither reset a
decision an admin has already made nor grant one. Asserted in
`supabase/test/rlstest.js` group 14, both directions.

`referral_order` has no UPDATE policy for anybody, admins included. The only
thing that moves the column is `review_referral_order()`, a SECURITY DEFINER
function that re-checks `app_is_admin()` itself — so a mistake in app-layer role
checking is not enough to approve a payout. Group 10 checks that a partner and a
KAM are both refused.

The partner sees the pending order, labelled "Being checked", with its value
shown but greyed and excluded from the total. A figure that quietly omits their
newest order with no explanation is one they assume is wrong.

### It also records tier unlocks

`recordUnlockedTiers()` (`lib/data/unlock.ts`, shared with the console) recomputes
each touched partner's **approved** total and inserts a `reward_claim` row for
each threshold crossed. It never deletes a claim — a corrected order value that
drops a partner back below a threshold does not un-give a gold coin.

Because orders now arrive pending, a sync normally crosses nothing and
`tiers_unlocked` comes back empty. It is still called: a re-sync that corrects an
already-approved order's value upward can cross a tier. The real caller is now
`reviewOrder()` in `lib/data/console-actions.ts`, which runs it the moment an
admin approves.

**`tiers_unlocked` in the response means "crossed by THIS sync", not "earned".**
That distinction cost a bug: the first version upserted with `ignoreDuplicates`
and reported everything *due*, so a nightly run announced all six tiers every
night. Anything hung off this field — an email, a push notification — would have
congratulated the partner daily for a coin they got in July. The route now reads
the existing claims first and reports only the difference. Verified against
production on 2026-09-11: re-posting a seeded order returns `tiers_unlocked: []`
and leaves the attributed total unchanged.

## The referral record

`referral.md_phone` is `NOT NULL` with a ten-digit CHECK, and
`createReferral()` refuses a number it cannot parse rather than storing `null`.
A referral with a wrong number is a referral whose orders will never be
credited, and it would sit there looking perfectly fine.

`UNIQUE (partner_id, md_phone)` means the same partner cannot double-refer one
client; the action turns that constraint violation into a readable message.

On a client's own page, the referral is matched by `client_id` first and exact
`phone` second — **never by name**. Two clients called Sharma are not one
person, and showing one client another's store visits would be worse than
showing nothing.
