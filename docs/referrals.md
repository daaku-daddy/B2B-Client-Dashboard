# Referrals

**Covers:** `components/referrals/** · app/api/sync/referrals/route.ts · referral · referral_event · referral_order`

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

**2. Exact phone matching, three outcomes.** A row matches one referral, matches
none, or matches **more than one** (two architects both claiming the same
client). The third is reported as `ambiguous` and skipped, never resolved by a
heuristic: attributing an order to the wrong architect pays the wrong person.

Every skip comes back in the response, with a reason
(`no_match` / `ambiguous` / `bad_phone` / `bad_row`). A sync that quietly dropped
forty orders because nobody had referred those phones is the failure that
reporting exists to prevent.

### It also records tier unlocks

After writing orders, `recordUnlockedTiers()` recomputes each touched partner's
attributed total and upserts `reward_claim` rows for every threshold crossed
(`ignoreDuplicates`, so it is safe to re-run). It never deletes a claim — a
corrected order value that drops a partner back below a threshold does not
un-give a gold coin.

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
