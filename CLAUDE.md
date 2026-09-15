# b2b-client-dashboard

**Material Depot for Partners** — two apps on one deployment.

`app/(app)/**` is what an architect or interior designer sees: the clients they
referred to us and what those clients did, their reward ladder, and their
portfolio. Behind a per-firm flag there is also a full project workspace —
design boards, quotes, procurement, project finances — **off by default**.

`app/(console)/**` is Material Depot's own B2B team: an admin who verifies
orders and issues logins, KAMs, outreach and inbound managers. Read
`docs/roles.md` before touching either.

Next.js 16 (App Router, Turbopack) + Tailwind 4 + Supabase. Deployed on Vercel
at <https://b2b-client-dashboard-eight.vercel.app/>.

**This repo is PUBLIC** (`daaku-daddy/B2B-Client-Dashboard`, verified
2026-09-14). Everything committed is world-readable, so no real partner or
client names, phone numbers, GSTINs, order values or tokens in code, seeds,
fixtures, commit messages or docs. `supabase/seed/001_demo.sql` is invented data
and must stay that way.

```bash
npm run dev        # next dev — NOTE: :3000 is usually the materialdepot-crm
                   #  dev server, so this lands on :3001. Read the log line.
npm run build      # next build
npm run typecheck   # tsc --noEmit
npm run test:domain # the pure rules, run directly — no bundler, no database

cd supabase/test && npm install && npm run all   # the SQL + RLS suite
```

There is no lint command. The gate is `npm run typecheck`, `npm run build`,
`npm run test:domain`, and — for anything touching `supabase/` — the suite in
`supabase/test`, which runs the migrations and both seeds against a throwaway
Postgres 18 and asserts **108** things about RLS. **Run all four before claiming
a change works.**

And then look at it. Every one of the six bugs in `docs/landmines.md` passed
`tsc` and `build`; five of them were found by signing in as the demo firm and
walking the tabs. `supabase/seed/001_demo.sql` exists so that is a two-minute
job rather than an hour of data entry.

## The one thing to know first

**No SQL in this repo runs itself.** `supabase/migrations/*.sql` and
`supabase/seed/001_demo.sql` are pasted into the Supabase SQL Editor by hand.
Both migrations were applied on 2026-09-11; `supabase/migrations/README.md` is
the checklist and says which of the three Material Depot Supabase projects this
one is.

**A migration committed here is not evidence it was applied.** If a column is
missing at runtime, check the live table before assuming the code is wrong. And
before handing anyone SQL to paste, run it through `supabase/test` — three of the
eight entries in `docs/landmines.md` are seed or migration bugs that would
otherwise have died a third of the way through someone's paste.

**SQL first, then deploy.** `currentActor()` reads `staff_user` on every page, so
a deploy that lands before `003`/`004` have been pasted shows every partner "We
could not load your workspace" until somebody notices.

Demo login, once the seed is in: `demo.studio@materialdepot.com` /
`DemoStudio2026!`. This Supabase project has **email confirmation ON**, so a
fresh sign-up gets "check your email" and no session — the seed confirms that
one address for you.

## Shape of the app

| Path | What it is |
|---|---|
| `proxy.ts` | Session refresh + the signed-out redirect. Next 16's `proxy` convention, not the deprecated `middleware`. |
| `app/(app)/**` | The partner app. `layout.tsx` resolves the firm, bounces staff to the console, gates onboarding. |
| `app/(console)/**` | Material Depot's B2B console. `layout.tsx` bounces partners back to their own app. |
| `app/login` | Email + password. Phone-OTP is the intended production login — see `docs/auth.md`. |
| `app/api/catalog/search` | Server proxy to Material Depot's catalogue. **Blocked today by Cloudflare, with Django CSRF behind it** — `docs/catalogue.md`. |
| `app/api/sync/referrals` | Push endpoint for referral events and orders. Service-role, shared-secret. |
| `lib/domain/**` | The rules: money, quantity, areas, rewards, markets, the internal tiering. No I/O in here. |
| `lib/data/**` | Partner reads/writes (`queries.ts`, `actions.ts`), console reads/writes (`console-*.ts`), the `Result` type, the session and the role gates. |
| `lib/auth/credentials.ts` | The one-time password generator. Never stored, never logged. |
| `components/**` | `ui/` primitives, then one folder per module. `console/` is staff-only and must never be imported from `app/(app)/`. |
| `test/domain.test.ts` | The pure rules, asserted at their boundaries. `npm run test:domain`. |
| `supabase/migrations/**` | The schema and the RLS policies. Pasted by hand. |
| `supabase/seed/001_demo.sql` | A whole demo firm — 5 projects, boards, quotes, procurement, ledger, referrals, rewards. Idempotent. |
| `supabase/seed/002_console.sql` | The demo B2B team, two more firms, prospects, onboarding forms, portfolios, activity. |
| `supabase/test/**` | Migrations + seeds + 108 RLS assertions against a throwaway Postgres. Its deps are deliberately outside the app's `package.json`. |

## House rules

Seven conventions carry most of the weight. Breaking one is how this app would
start lying to an architect about their own money — or show their margins to a
supplier.

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

### 5. A write must not destroy what it was not told about

An upsert writes every column in its payload, so building a row with
`store: o.store ?? null` blanks the store on every re-sync that omits it.
Payload-shaped writes go through a `defined()` filter that drops `undefined`
keys; an explicit `null` still clears. This one shipped — `docs/landmines.md`.

### 6. Material Depot staff see the relationship, never the work

No policy anywhere lets staff read `client`, `project`, `project_area`, `board`,
`board_item`, `quote`, `quote_line`, `procurement_item` or `finance_entry`. A
KAM can see which clients a firm referred to us and what those clients bought
from us; they cannot see that firm's own client list, its quotes or its margins.

That is the only reason a designer would put their pricing in a supplier's
portal, and a "just for support" read policy on any one of those tables would
throw it away. `supabase/test/rlstest.js` group 8 checks all nine by name.

### 7. The money gate lives in the database

Only an `approved` order counts towards a partner's rewards, and
`referral_order` has **no UPDATE policy for anybody**. The single thing that can
change that column is `review_referral_order()`, which re-checks
`app_is_admin()` inside Postgres. Same for publishing a portfolio piece.

App-layer role checks (`requireStaff`) are there so the UI can be honest, not so
the database can be trusted to a form field. A bug in one must not be enough to
hand somebody a gold coin.

## Docs

Module detail lives in `docs/`, read on demand:

| Doc | Holds |
|---|---|
| `docs/roles.md` | **The three kinds of user, the console, market segregation, and the trust boundary. Start here.** |
| `docs/onboarding.md` | Outreach → the form → admin verification → credentials; the internal Power/Mid/Basic classification |
| `docs/portfolio.md` | Partner portfolios and the publish gate |
| `docs/auth.md` | The login model, `onboard_partner`, why not phone OTP yet |
| `docs/catalogue.md` | The Material Depot search API, its field names, and the CSRF wall |
| `docs/design.md` | Rooms, boards, the palette link, how quantities are worked out |
| `docs/quote.md` | Building a quote, markup, the client PDF, accepting |
| `docs/procurement.md` | The list, quantity-vs-row progress, status auto-advance |
| `docs/finance.md` | Why the ledger is hand-entered and not derived from the quote |
| `docs/referrals.md` | The three systems referral data lives in, and the sync contract |
| `docs/rewards.md` | The six tiers, cumulative unlocking, handover |
| `docs/open-questions.md` | What is decided by default and needs a human to confirm |
| `docs/landmines.md` | **Six bugs already shipped here**, kept because the shape of each recurs. Read before trusting a passing build. |
| `supabase/test/README.md` | What the 51 assertions cover, and the two shim details that are load-bearing |

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

Environment variables live in the Vercel project, not here. All four are set on
**Production and Development** as of 2026-09-11:
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `SYNC_SHARED_SECRET`.

**Preview is still missing the two `NEXT_PUBLIC_*` ones** — `vercel env add …
preview` loops on `git_branch_required` whichever documented form you use, so
they need adding in the dashboard.

An env var only reaches a NEW deployment, so `vercel --prod` after changing one.
`/api/sync/referrals` returns 503 naming the missing variable rather than
failing silently, which is also how you check from outside whether a deploy
picked the value up.
