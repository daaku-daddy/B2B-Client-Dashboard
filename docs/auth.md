# Auth and onboarding

**Covers:** `app/login · proxy.ts · lib/data/session.ts · components/shell/Onboarding.tsx · onboard_partner()`

## Email + password, for now

Supabase Auth with email and password. `proxy.ts` refreshes the session on every
request (Server Components cannot set cookies, so it cannot happen in a layout)
and redirects a signed-out user to `/login?next=<where they were going>`.

**Phone + OTP is the right production login and is not wired in.** Material
Depot's own identity is a phone number: `palette.materialdepot.com` signs in with
`/api/login-otp?contact=<10 digits>&country_code=91` then
`/api/verify-otp?…&otp=<4 digits>`, and gets a bearer token back. Using it here
would mean a partner has one account across the storefront, palette and this
dashboard — the same account their wishlist and their referrals hang off.

It is not wired in because those endpoints need allowlisting for this origin
(the same wall as `docs/catalogue.md`). So sign-up takes the partner's phone as
a field instead, and `partner.phone` is the exact join key regardless of how
they log in. **Swapping the login later touches no other table.**

## `onboard_partner()` — why signing up is an RPC

A user cannot `INSERT` into `partner_user`. If they could, anyone could join any
firm by guessing a uuid and would then read that firm's clients and margins.

So `onboard_partner()` (SECURITY DEFINER, in `002_rls.sql`) creates the firm and
links the caller as its principal in one transaction, and:

- refuses if the caller already belongs to a firm,
- normalises the phone to bare ten digits (accepting `+91…`, `91…`, spaces) and
  refuses anything that is not a real Indian mobile,
- refuses if a firm is **already registered on that phone**, naming the number.
  A second login for an existing firm is a real case but not a self-serve one —
  it needs whoever owns the firm to agree, so it is a support action.

## The three states of `currentSession()`

| Result | Means | What the layout does |
|---|---|---|
| `ok: true, data: Session` | signed in, firm resolved | render the app |
| `ok: true, data: null` | signed in, **no firm yet** | render `<Onboarding>` |
| `ok: false` | the query failed | render `<Problem>` |

The third must never fall through to the second. Offering the sign-up form when
the database is merely unreachable would invite a partner to create a **second
firm on top of their real one**, and the phone-uniqueness check is the only
thing that would stop them.

`Onboarding` also picks up the `pending_firm` blob that `/login` stashes in
`localStorage`: with email confirmation on, sign-up has no session to create the
firm with, so the answers are kept and used on first real sign-in rather than
being asked for twice.

## Roles

`partner_user.role` is `principal` | `associate` | `viewer`. RLS reads through
`app_can_write()`, which admits the first two — so a `viewer` can see everything
the firm has and change none of it. Nothing in the UI creates additional logins
yet; that is a support action today.
