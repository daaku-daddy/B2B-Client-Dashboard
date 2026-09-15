# Bugs already shipped here

Six, in this repo's first two days. Kept because the **shape** of each one
recurs, and because every one of them passed `tsc` and `next build` first.

Add to this file when you fix a bug whose shape could come back. Date it, and
say what it looked like from the user's side — that is the part that makes the
next person recognise it.

---

## 2026-09-11 · A partial sync payload erased columns it never mentioned

`/api/sync/referrals` built its rows as `store: o.store ?? null`. An upsert
writes every column in the payload, so a re-sync carrying only `md_enq_id` and
`order_value` **blanked the store and the date** on a row that already had them.

*From the user's side:* an order in the Rewards table with a dash where
"Whitefield" had been, and no order date. Nothing errored.

Rows now go through `defined()`, which drops keys whose value is `undefined`.
An explicit `null` still clears — that is how a caller says "empty this".

**The shape:** any upsert built from an optional-field payload. `?? null` in a
row literal is the tell. Found by re-posting a seeded row during testing, which
is the cheapest way to look for it.

---

## 2026-09-11 · `auth.users.confirmed_at` cannot be written

The seed tried to confirm the demo login with
`set email_confirmed_at = …, confirmed_at = …` and failed with
`428C9: column "confirmed_at" can only be updated to DEFAULT`. In Supabase it is
`GENERATED ALWAYS AS (least(email_confirmed_at, phone_confirmed_at)) STORED`.

Set `email_confirmed_at` only; the other follows for free. `supabase/test/shim.sql`
reproduces the generated column so this cannot regress silently.

**The shape:** assuming a Supabase-managed schema is plain columns.

---

## 2026-09-11 · The seed linked a login to a firm that did not exist yet

`partner_user` was inserted before `partner`, so the whole file died on
`23503 violates foreign key constraint`, a third of the way through a paste.

**The shape:** ordering in a hand-run SQL file. Nothing checks it but running it.

---

## 2026-09-11 · Procurement truncated the Material Depot enquiry id

`md_enq_id` sat in a `w-28` input. `ENQ2026072884321` rendered as
`ENQ2026072884` — not a shortened number, **a different one** to anyone reading
it off the screen and quoting it to Material Depot.

*From the user's side:* nothing looks wrong. That is what makes it bad.

**The shape:** an identifier in a fixed-width input. Identifiers need room for
their real length, or a `title` at minimum. Check the longest live value, not a
placeholder.

---

## 2026-09-11 · An accepted quote could still be repriced

`quote_line` editing was locked once a quote was `accepted`, but the quote-level
markup, discount and validity beside it were not — so the total a client had
agreed to could be changed afterwards, with no record.

Accepted quotes now render as a read-only summary pointing at Rebuild.

**The shape:** locking a record at one level and not the other. If part of a
thing becomes immutable, all of it has to.

---

## 2026-09-11 · Every board cover rendered blank, from images that loaded fine

The seed used `palette.materialdepot.com/cdn-img/main/general-images/<uuid>.png`.
Those are real, public, return `200 image/webp`, and are palette's scene
**compositing layers** — near-transparent, ~2 KB. So `img.complete` was `true`,
`naturalWidth` was 800, the element was 363×96 and visible, and there was
nothing to see.

The photographs are `/cdn-img/azure/application_image/<scene>-medres.jpg`,
40–124 KB. See `docs/catalogue.md`.

**The shape:** verifying an asset with a status code. `200` means a response
arrived, not that it is a picture. Check the byte size.

Second lesson from the same bug: a JPEG page screenshot can be captured before
images paint even when `complete` is `true`. Zoom into the region before
concluding an image is broken.

---

## 2026-09-15 · A guard trigger locked the SQL Editor out of its own table

`partner_guard_md_fields()` refuses a non-admin's change to the columns Material
Depot owns, and decided "non-admin" with `app_is_admin()` alone. The service role
and the SQL Editor have no `auth.uid()`, so `app_is_admin()` is false for them —
and `seed/002_console.sql` died on `42501 that field is set by Material Depot,
not by the firm` while trying to set the demo firm's own market.

*From the user's side:* a seed file that runs fine as far as section 2 and then
stops, with an error that reads like a permissions misconfiguration.

The guard now passes anything through when `auth.uid() is null`. That is safe
because every signed-in route into the table is a policy that is `to
authenticated` and needs a uid, so a null uid cannot be a partner.

**The shape:** a trigger written in terms of "is this user allowed" when the
thing doing the writing is not a user at all. RLS has `service_role bypassrls`;
triggers have no such thing and fire for everybody. Any `SECURITY DEFINER` guard
needs an explicit answer for "there is no caller".

---

## 2026-09-15 · Three RLS assertions passed by not testing anything

New tests, caught before they were trusted, but the shape is worth keeping:

- `update partner set workspace_enabled = true` to prove a firm *cannot* — the
  demo firm already had it `true`, `is distinct from` was false, and the guard
  let the no-op through. The test reported "IT WENT THROUGH" on a guard that
  works. Now `not workspace_enabled`.
- Setting a portfolio item to `submitted` and *then* trying to publish it — the
  `using` clause rejected the second update for 0 rows, which the harness read as
  blocked. It was, but by the wrong clause; `with check` on the status was never
  exercised. Now the publish attempt runs first, on a genuine draft.
- Counting partner rows to prove market scoping, when the suite's own fixture
  firm has `market = null` and is *deliberately* visible to everyone. Correct
  behaviour read as a leak. Now asserted by id.

**The shape:** an expected-failure test that would also pass if the thing under
test did nothing. Three separate ways to get it — writing the value that is
already there, tripping an earlier guard than the one you mean, and counting
rows when a documented exception is in the count. Make the write a real change,
assert the specific refusal, and name the rows.
