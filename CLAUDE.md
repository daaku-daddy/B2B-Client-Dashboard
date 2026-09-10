# b2b-client-dashboard

**Material Depot for Partners** — the workspace architects and interior
designers run their projects in: design boards, quotes, procurement, project
finances, and visibility of the clients they refer to Material Depot.

Next.js 16 (App Router, Turbopack) + Tailwind 4 + Supabase. Deployed on Vercel
at <https://b2b-client-dashboard-eight.vercel.app/>.

```bash
npm run dev        # next dev — NOTE: :3000 is usually the materialdepot-crm
                   #  dev server, so this lands on :3001. Read the log line.
npm run build      # next build
npm run typecheck  # tsc --noEmit — the only automated check in this repo
```

There is no lint command and no test suite. `npm run typecheck` plus
`npm run build` is the whole gate; run both before claiming a change works.

## The one thing to know first

**The database schema is not applied by anything in this repo.** `supabase/migrations/*.sql`
has to be pasted into the Supabase SQL Editor by hand. Until it is, every page
renders its "could not load your workspace" state — which is correct behaviour,
not a bug. See `supabase/migrations/README.md` for the checklist and which of
the three Material Depot Supabase projects this one is.

## Shape of the app

| Path | What it is |
|---|---|
| `proxy.ts` | Session refresh + the signed-out redirect. Next 16's `proxy` convention, not the deprecated `middleware`. |
| `app/(app)/**` | Every signed-in page. `layout.tsx` resolves the partner and gates onboarding. |
| `app/login` | Email + password. Phone-OTP is the intended production login — see `docs/auth.md`. |
| `app/api/catalog/search` | Server proxy to Material Depot's catalogue. **Blocked today** — `docs/catalogue.md`. |
| `app/api/sync/referrals` | Push endpoint for referral events and orders. Service-role, shared-secret. |
| `lib/domain/**` | The rules: money, quantity, areas, rewards, project stages. No I/O in here. |
| `lib/data/**` | Reads (`queries.ts`), writes (`actions.ts`), the `Result` type, the session. |
| `components/**` | `ui/` primitives, then one folder per module. |

## House rules

Four conventions carry most of the weight. Breaking one is how this app would
start lying to an architect about their own money.

### 1. A failure is never an empty list

Every read and write returns `Result<T>` (`lib/data/result.ts`) and every caller
renders `<Problem>` on the failure branch. Returning `[]` on error is banned:
Material Depot has already shipped a roster that failed to load and rendered as
"no staff", and a dashboard that errored and read as a quiet day. The catalogue
search goes further and has **three** states — `ok`, `empty`, `unavailable` —
because "the search never ran" and "no product matches" are different facts.

Same rule on identity: a phone lookup either matches exactly one referral,
matches none, or is **ambiguous**. The third is reported, never folded into the
second.

### 2. Prices are snapshots, not lookups

`board_item` and `quote_line` each carry their own `sku`, `unit`, `rate`,
`gst_pct`, `coverage_area`. A quote that re-prices itself between being sent and
being accepted cannot be sent to a client. `priced_at` says how old the snapshot
is; rebuilding the quote is how you take a new one.

### 3. Material Depot rates are TAX-INCLUSIVE

`lib/domain/money.ts` is the only place that does money arithmetic, and it
documents why: the catalogue field is `selling_price_with_tax`, so GST is
**backed out** for display and never added on top. Markup applies to the
tax-inclusive figure. Do not add an "is this inclusive?" flag anywhere.

### 4. Derived totals are never stored

Reward progress, client spend, procurement percentages and project P&L are all
computed at read time from the rows they come from. `referral_order.md_enq_id`
is unique, which is what makes the incentive total idempotent under a re-sync.
`reward_claim` records that a tier was *reached* and whether it was handed over
— it is not the source of truth for whether it is unlocked.

## Docs

Module detail lives in `docs/`, read on demand:

| Doc | Holds |
|---|---|
| `docs/auth.md` | The login model, `onboard_partner`, why not phone OTP yet |
| `docs/catalogue.md` | The Material Depot search API, its field names, and the CSRF wall |
| `docs/design.md` | Rooms, boards, the palette link, how quantities are worked out |
| `docs/quote.md` | Building a quote, markup, the client PDF, accepting |
| `docs/procurement.md` | The list, quantity-vs-row progress, status auto-advance |
| `docs/finance.md` | Why the ledger is hand-entered and not derived from the quote |
| `docs/referrals.md` | The three systems referral data lives in, and the sync contract |
| `docs/rewards.md` | The six tiers, cumulative unlocking, handover |
| `docs/open-questions.md` | What is decided by default and needs a human to confirm |

**When you change behaviour a doc describes, update that doc in the same
commit.** A doc describing last month's behaviour is worse than no doc, because
the next session will trust it.

## Deploying

Vercel project `material-depot1/b2b-client-dashboard`, built from `main` on
push. `vercel.json` pins `"framework": "nextjs"` **on purpose**: the project was
originally created with a static preset and every build failed with *No Output
Directory named "public" found* even though `next build` had just succeeded.
Keeping the framework in the repo means a new deployment cannot inherit that
setting again.

Environment variables live in the Vercel project, not here. Production and
Development carry the two `NEXT_PUBLIC_SUPABASE_*` values; `SUPABASE_SERVICE_ROLE_KEY`
and `SYNC_SHARED_SECRET` are **not set**, so `/api/sync/referrals` returns 503
until they are. That is the intended behaviour — it says which variable is
missing rather than failing silently.
