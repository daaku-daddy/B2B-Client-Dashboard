# Decisions taken by default

Everything here was decided so the build could finish. Each one is a real
product call that someone may want to overrule — none of them is load-bearing
enough that changing it is expensive.

| # | Question | What was decided, and why |
|---|---|---|
| 1 | How do partners log in? | Email + password. Phone + OTP is the right answer and needs Material Depot's OTP endpoints allowlisted for this domain — `docs/auth.md`. `partner.phone` is the join key either way, so swapping later touches no other table. |
| 2 | Where does the architect's markup live? | On the quote (`markup_pct`), overridable per line. The alternative — a markup per product category — is more expressive and much more to maintain. |
| 3 | Does the client see the Material Depot rate? | No. The PDF shows the marked-up figure only. |
| 4 | Is the project P&L derived from the quote? | No — hand-entered ledger. Quoted and paid are different facts; `docs/finance.md`. |
| 5 | Can two partners refer the same client? | The schema allows it (`UNIQUE (partner_id, md_phone)`, not global) and the sync refuses to attribute that client's orders to either — reported as `ambiguous`. Deciding whose it is needs a human. |
| 6 | Do rewards ever expire or reset annually? | No — the ladder is lifetime and cumulative. An annual reset would need a period column on `reward_order` aggregation and a policy nobody has stated. |
| 7 | Does dropping below a threshold revoke a tier? | No. `reward_claim` rows are never deleted. |
| 8 | Who confirms a reward was handed over? | Material Depot, not the partner. `reward_claim` has no partner write policy — the UI says "your Material Depot contact will arrange the handover". |
| 9 | Can a partner add colleagues? | Not self-serve. `partner_user` has no insert policy; `onboard_partner()` refuses a second firm on the same phone and says to ask Material Depot. |
| 10 | Wastage default | 0%, set per item. A silent default of 5–10% would inflate quotes in a way nobody asked for. |

## Known gaps, named rather than faked

- **The catalogue is unreachable** from this deployment. Verified live: the
  outer wall is Cloudflare bot protection on `api.materialdepot.com` rejecting
  datacentre egress, with Django's CSRF check behind it. Two owners, two fixes,
  in that order — `docs/catalogue.md`. The product picker says which wall it hit
  and offers manual entry.
- **Referral data has no producer yet.** `/api/sync/referrals` is the contract
  and it works; nothing is pushing to it. Until something does, the referral
  timeline is empty and says so.
- **Palette boards are linked, not embedded.** "Visualise in Palette" opens
  palette in a new tab with the right scene. Saving a rendered scene back onto a
  board (palette has `/api/upload` and a Save button) would need palette to
  round-trip a board id.
- **No client-facing view.** An architect can export the quote PDF; there is no
  link a client can open to approve a board themselves. That is the obvious next
  module and needs a share-token table.
- **No image upload.** `board.cover_url` and `board_item.image_url` accept URLs;
  nothing uploads to Supabase Storage yet, so covers only appear for catalogue
  products.
