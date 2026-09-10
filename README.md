# Material Depot for Partners

The workspace architects and interior designers use to run their projects with
Material Depot — design boards built from real products, quotes, procurement,
project finances, and full visibility of the clients they refer to us.

Live: <https://b2b-client-dashboard-eight.vercel.app/>

## Getting it running

```bash
npm install
cp .env.local.example .env.local     # fill in the service-role key if you need the sync route
npm run dev
```

**Then apply the database schema**, which nothing in this repo does for you:
paste `supabase/migrations/001_init.sql` and `002_rls.sql` into the Supabase SQL
Editor for project `vmwvxwqzqxhwesjokztf`, in that order. Until you do, every
page shows "we could not load your workspace" — see
`supabase/migrations/README.md`.

## What is in it

- **Clients and projects** — one client, many projects, each in one of three
  stages: design, procurement, execution.
- **Design** — rooms, then two or three inspiration boards per room built from
  the live Material Depot catalogue with prices and quantities. The client picks
  one; that one becomes the quote.
- **Quote** — built from the signed-off boards, with the architect's markup on
  top, and a client-facing PDF that shows the client's price and nothing else.
- **Procurement** — accepting a quote seeds the list; track ordered, delivered
  and installed quantities against it.
- **Money** — a per-project ledger of what comes in and what goes out, with
  receivables, payables and the real margin.
- **Referrals** — every client sent to Material Depot, and what they did: which
  store, when, what they looked at, what is in their cart, what they ordered.
- **Rewards** — six cumulative milestones from ₹1 L to ₹50 L, from a silver coin
  to a trip to Europe, with progress towards the next one.

Development notes, conventions and module docs are in `CLAUDE.md` and `docs/`.
