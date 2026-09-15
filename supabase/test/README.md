# SQL tests

Runs every file in `migrations/`, both files in `seed/`, and an RLS isolation
suite against a **throwaway Postgres 18** that lives in `./data`. Nothing here touches the real Supabase
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

132 checks, in fifteen groups:

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
7. **Market segregation.** The Bangalore outreach manager sees the Bangalore
   firm and not the Hyderabad one; the Hyderabad KAM sees the reverse; a staff
   member with no market set sees both. Asserted **by id, not by row count** —
   the suite's own fixture firm has no market and is deliberately visible to
   everyone, so counting would make a documented rule read as a leak.
8. **The trust boundary.** An admin and a KAM read zero rows from all nine of
   `client`, `project`, `project_area`, `board`, `board_item`, `quote`,
   `quote_line`, `procurement_item`, `finance_entry` — while still reading the
   referrals a firm sent us. This is the group that matters most.
9. A partner reads nothing from `staff_user`, `partner_application`,
   `outreach_prospect` or `outreach_touch`; sees their own activity minus the
   rows staff marked internal; and gets exactly one row from `my_kam()`.
10. **The order approval gate.** A partner's direct UPDATE matches 0 rows, a
    partner and a KAM are both refused by `review_referral_order()`, and an
    admin succeeds and is stamped as the approver.
11. **The portfolio gate.** A firm can submit a draft and cannot publish it
    (`42501` from the `with check`), a published piece is frozen, and only an
    admin can call `review_portfolio_item()`.
12. **The fields Material Depot owns.** A firm can rename itself and cannot
    touch `workspace_enabled`, `kam_user_id`, `market`, `phone` or
    `internal_note`; an admin can.
13. `onboard_partner()` refuses a login that already belongs to the staff table.
14. **A re-sync cannot undo an approval** — the exact upsert PostgREST generates
    for `/api/sync/referrals` leaves `approval_status` and the columns it did not
    send alone, and a newly synced order arrives `pending`.
15. **Everything the firm-view page reads, and nothing more.** The eight tables
    behind `/console/partners/[id]/dashboard` are asserted readable by an admin
    for a firm they do not personally manage, unreadable by a KAM in the wrong
    market, and — in the same breath — still zero rows in all nine private
    tables. That page added no policy, and this group is what would notice if
    somebody later added one.

Every expected-failure check is wrapped in a savepoint. Without that, the first
`42501` aborts the transaction and every later assertion reports `25P02`
instead — which looks like four bugs and is one harness mistake.
