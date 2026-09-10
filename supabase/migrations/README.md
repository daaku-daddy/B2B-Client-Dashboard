# Migrations

Nothing in this repo runs these. Paste each file into
**Supabase → SQL Editor → Run**, in order, against project
`vmwvxwqzqxhwesjokztf`.

Every file is idempotent — re-running one is safe and is the intended way to
apply a change to it.

| File | What it does | Applied |
|---|---|---|
| `001_init.sql` | Tables, indexes, the six reward tiers, `updated_at` triggers | ☐ |
| `002_rls.sql` | RLS on every table, ownership helper functions, `onboard_partner()` | ☐ |

Tick the box in this table when you have run it, and say so in the commit. A
migration committed here is **not** evidence it was applied — if a column is
missing at runtime, check the live table before assuming the code is wrong.

## Which project

Three Material Depot Supabase projects exist and they are easy to confuse:

| Project | What lives there |
|---|---|
| `vmwvxwqzqxhwesjokztf` | **this app** — partners, projects, boards, quotes, referrals |
| `olkkioacgccgsjjlmbhc` | the internal CRM (`materialdepot-crm`) |
| `jqrdfnjfxqxrazfkaofm` | the field-ops apps (site audit, installations) — runs with RLS **off** |

This app runs with RLS **on**, unlike the field-ops project. That is not an
oversight to be tidied up: the anon key ships to every architect's browser, and
one architect must not be able to read another's client list or margins.
