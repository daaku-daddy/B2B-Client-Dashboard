# SQL tests

Runs `migrations/`, `seed/` and an RLS isolation suite against a **throwaway
Postgres 18** that lives in `./data`. Nothing here touches the real Supabase
project, and its dependencies are deliberately kept out of the app's
`package.json` so building the site never downloads Postgres binaries.

```bash
cd supabase/test
npm install
npm run all          # start postgres → migrate → seed → rls suite
npm run pg:stop      # when you are done
rm -rf data pg.log   # to start from an empty cluster
```

If `npm install` prints `allow-scripts … not yet covered`, the Postgres binaries
may not have been linked. Run
`node node_modules/@embedded-postgres/darwin-arm64/scripts/hydrate-symlinks.js`
once, or `npm approve-scripts @embedded-postgres/darwin-arm64`.

**Start from an empty cluster when a test result looks wrong.** `run.js` connects
to whatever is already listening on 54329 — including a cluster left running by
an earlier session — and a stale one shows up as `42710 role "anon" already
exists` and inflated row counts, not as a clear error.

`shim.sql` stands in for what Supabase provides: the `anon` / `authenticated` /
`service_role` roles, an `auth.users` table and `auth.uid()` reading
`request.jwt.claim.sub`. Two details in it are load-bearing:

- **`auth.users.confirmed_at` is a GENERATED column**, exactly as it is in
  Supabase. That is not decoration — the first version of the seed tried to
  write it and failed with `428C9: column "confirmed_at" can only be updated to
  DEFAULT`. Only `email_confirmed_at` is writable.
- `auth.uid()` reads a request setting, so `rlstest.js` can be one login and
  then another inside one connection.

## What `rlstest.js` asserts

51 checks, in six groups:

1. The demo partner can read all thirteen of their own tables.
2. **A second architect reads none of it.** This is the whole reason RLS is on
   in this project — it is checked table by table, plus a by-name probe for one
   of the other firm's clients.
3. A signed-out (`anon`) session reads nothing at all, `reward_tier` included.
4. **A partner cannot forge the rows their own payout is computed from** —
   `referral_order`, `referral_event` and `reward_claim` inserts all come back
   `42501`. If any of these ever passes, the incentive scheme is self-service.
5. A partner cannot join another firm by guessing its uuid.
6. `onboard_partner()` normalises `+91 98450 99887` to ten digits, refuses a
   second firm for one login, refuses a phone another firm already holds, and
   refuses a number that is not an Indian mobile.

Every expected-failure check is wrapped in a savepoint. Without that, the first
`42501` aborts the transaction and every later assertion reports `25P02`
instead — which looks like four bugs and is one harness mistake.
