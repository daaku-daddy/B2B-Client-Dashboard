# Material Depot for Partners

Two apps on one deployment.

**For architects and interior designers** — see every client you sent to
Material Depot and exactly what they did with us, track the reward ladder those
orders earn you, and put your work on our site. A full project workspace (design
boards, client quotes, procurement, project P&L) is built and switched off by
default; Material Depot turns it on per studio, when the studio asks.

**For Material Depot's B2B team** — an admin who verifies referred orders and
issues partner logins, key account managers, and outreach managers working
Bangalore and Hyderabad separately.

Live: <https://b2b-client-dashboard-eight.vercel.app/>

## Getting it running

```bash
npm install
cp .env.local.example .env.local     # fill in the service-role key if you need the sync route
npm run dev
```

**Then apply the database schema**, which nothing in this repo does for you:
paste `supabase/migrations/001_init.sql`, `002_rls.sql`, `003_roles.sql` and
`004_roles_rls.sql` into the Supabase SQL Editor for project
`vmwvxwqzqxhwesjokztf`, in that order. Until you do, every page shows "we could
not load your workspace" — see `supabase/migrations/README.md`, which also has
the snippet that makes the first admin.

## What a partner sees

- **Your clients** — everyone you sent to Material Depot, and what they did:
  which store, when, what they looked at, what is in their cart, what they
  ordered. Each order says whether we have verified it yet.
- **Rewards** — six cumulative milestones from ₹1 L to ₹50 L, from a silver coin
  to a trip to Europe, with progress towards the next one. Only orders we have
  verified count, and the ones still being checked are shown separately rather
  than quietly left out.
- **Portfolio** — add your finished projects and send them to us; we publish them
  on materialdepot.com with a link back to you.
- **Your Material Depot contact** — who your KAM is and how to reach them, plus
  everything we have done on your account.

Behind `workspace_enabled`, per studio: clients and projects, rooms and
inspiration boards built from the live catalogue, quotes with your own markup and
a client-facing PDF, a procurement list, and a per-project ledger. **Nobody at
Material Depot can read any of it** — that is enforced by row-level security, not
by convention, and checked by name in the test suite.

## What the B2B team sees

- **Today** — what is waiting on you, by role.
- **Verify** (admin) — referred orders, and partner work for the site. An order
  counts towards nothing until it is approved here.
- **Onboarding** — the form an outreach manager files after a meeting, an admin's
  verification, and the one-time credentials issued from it.
- **Firms** — everyone on the platform, who looks after them, and who has gone
  quiet. Internal only.
- **Outreach** — the firms we are talking to who are not with us yet, with every
  call and meeting against them.
- **Team** (admin) — who does what, in which market.

Development notes, conventions and module docs are in `CLAUDE.md` and `docs/` —
start with `docs/roles.md`.
