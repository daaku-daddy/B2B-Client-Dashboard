# Procurement

**Covers:** `components/procurement/** · procurementSummary()`

## Progress is quantity, not rows

`procurementSummary()` computes `pctOrdered` / `pctDelivered` from summed
**quantities**, because half the tiles for one room arriving is not "one of six
items done". Row counts are reported alongside, since that is what the list
looks like on screen — but the percentage is the quantity.

Quantities are clamped to `qty_required` when summing, so a 10% over-order
cannot push the project past 100% delivered.

Cancelled lines are excluded from every figure.

## Status follows the quantities

Typing an ordered / delivered / installed quantity moves `status` with it —
`installed > delivered > ordered > pending` — so the two cannot drift apart. The
first delivery also stamps `delivered_on`.

The dropdown stays editable by hand for the two cases no quantity implies:
`cancelled`, and a short delivery that needs saying out loud. A row already
`cancelled` is never auto-advanced.

## `md_enq_id`

The Material Depot enquiry / order id, typed in per line. Exact, no fuzzy
matching — it is what ties a procurement line to a real order, and the same
identifier the referral sync uses for `referral_order.md_enq_id`. Getting a
Django order feed to fill this in automatically is the obvious next step and
needs the same allowlisting as `docs/catalogue.md`.
