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
| 11 | Do partners get the project workspace on day one? | **No.** `partner.workspace_enabled` defaults to false and an admin turns it on per firm. The brief was explicit that designers are wary of moving their workflow into a supplier's portal, and a nav full of modules nobody asked for is what makes that worse. Nothing is deleted — `docs/roles.md`. |
| 12 | Does a referred order count as soon as it syncs? | **No.** It arrives `pending` and an admin verifies it. Overruling this is one line in `attributedSale()`, but the claim rows it would write are never deleted, so it is cheap to keep and expensive to undo. |
| 13 | Who verifies an order — anyone on the B2B team, or only an admin? | Only an admin, enforced inside Postgres by `review_referral_order()`. A KAM verifying their own firms' orders is the one person with a reason not to look hard. |
| 14 | How are credentials delivered? | Generated on approval and **shown once** to the admin, who sends them. There is no mail transport on this deployment; `auth.admin.inviteUserByEmail()` is the swap once Supabase SMTP is configured — `docs/onboarding.md`. |
| 15 | How long before a firm "needs reactivating"? | 90 days with no verified order — `DORMANT_AFTER_DAYS`. The brief said three months. "Never ordered" is kept as a separate third state, not folded into dormant. |
| 16 | What does the inbound manager's flow look like? | **Unanswered.** Inbound currently gets the same prospect pipeline as outreach, with no market restriction. The brief named the role and not the flow, so this is a placeholder that works rather than a design. |
| 17 | Can one firm have several logins? | Still not self-serve — `partner_user` has no insert policy. An admin can now issue a *replacement* password from the console, which covers the case that actually came up (a firm that cannot get in), but not a second seat. |
| 18 | Is a referred client's cart still open? | **Derived, and conservatively.** Nothing in the sync says. The newest `cart_add` counts as converted once an `order_placed` event or a dated `referral_order` row lands at or after it; otherwise it reads as open. A producer can overrule it outright with `payload.cart_status`. Erring towards "open" is deliberate — a wrongly-open cart costs an awkward phone call, a wrongly-closed one costs the sale nobody chased. `docs/referrals.md`. |

## Known gaps, named rather than faked

- **The catalogue is unreachable** from this deployment. Verified live: the
  outer wall is Cloudflare bot protection on `api.materialdepot.com` rejecting
  datacentre egress, with Django's CSRF check behind it. Two owners, two fixes,
  in that order — `docs/catalogue.md`. The product picker says which wall it hit
  and offers manual entry.
- **Referral data has no producer yet — but one is now designed.**
  `/api/sync/referrals` is the contract and it works; nothing is pushing to it,
  so the referral timeline is empty and says so. The producer belongs in the
  CRM, not here: `materialdepot-crm` `docs/b2b/partner-bridge.md` (2026-09-14)
  holds the push contract, the exact-phone matching rule, and the one endpoint
  this app still owes — `POST /api/sync/partners`, plus migration `003` adding
  `partner.md_client_id unique` so a CRM client row and a partner row are
  linked rather than name-matched. That design also records why **this app must
  never call Django** for it. The CRM holds 26 architect/interior-design firms
  with valid phones that could be provisioned today; this project holds one, the
  demo seed.
- **Palette boards are linked, not embedded.** "Visualise in Palette" opens
  palette in a new tab with the right scene. Saving a rendered scene back onto a
  board (palette has `/api/upload` and a Save button) would need palette to
  round-trip a board id.
- **No client-facing view.** An architect can export the quote PDF; there is no
  link a client can open to approve a board themselves. That is the obvious next
  module and needs a share-token table.
- **Nothing renders the published portfolios.** This app holds the submissions
  and the review state. Whatever builds the partners page on materialdepot.com
  reads `portfolio_item where status = 'published'`; that consumer does not exist
  yet — `docs/portfolio.md`.
- **No email, anywhere.** Credentials are shown once to an admin to send by hand,
  and nothing notifies a partner when an order is verified or a project is
  published — they see it in their account history next time they look. Both are
  named in the UI rather than faked.
- **The CRM does not know about any of this yet.** `partner.md_client_id` exists
  and is unique, ready for the bridge in `materialdepot-crm`
  `docs/b2b/partner-bridge.md`, and nothing sets it. The 26 architect and
  interior-design firms the CRM already holds still have to be onboarded through
  the form by hand.
- **No image upload.** `board.cover_url` and `board_item.image_url` accept URLs;
  nothing uploads to Supabase Storage yet, so covers only appear for catalogue
  products.
