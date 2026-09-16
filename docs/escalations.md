# Escalations

**Covers:** `escalation · escalation_comment · components/referrals/Escalations.tsx ·
set_escalation_status() · reopen_escalation()` — PRD §9.4

## Why this is not just a support inbox

An **open** escalation against an order holds that order's maturation (§10.5).
So this table is read by the money path — `lib/domain/ledger.ts` takes
`open_escalations` per order — and not only by a support screen. Two
consequences:

1. A partner must not be able to move the status. `escalation` has **no UPDATE
   policy for a partner**, and a firm that could mark its own ticket resolved
   could release its own order's maturation. The one move they get is
   `reopen_escalation()`, and only from `resolved` or `closed`.
2. The form says maturation is held **before** the partner submits. A partner
   who raises a ticket about a short delivery and then finds their cashback
   delayed, with no warning, reads it as a punishment for complaining.

## The internal-note split

§9.4: "Threaded comments visible to partner; internal notes hidden."

The hiding is a **policy**, not a `where internal = false` in a query. Two
separate SELECT policies, so the partner-side rule can be read on its own and
checked. A filter in application code is one forgotten call away from showing a
KAM's private note to the firm it is about, and that is the single most
expensive thing this module could leak. `escalation_comment_partner_write` has
`with check (not internal and author_side = 'partner')`, so a partner cannot
author an "internal" note even if a form lies about the flag.

`supabase/test/rlstest.js` group 16 checks both directions by name.

## What is NOT built

**Attachments.** §9.4 specifies images and PDFs up to 10MB, max 5. The
`attachments text[]` column exists; nothing in this app uploads to Supabase
Storage yet. The form says to send files to the KAM rather than showing a file
picker that silently drops what was selected.

**The staff side.** `set_escalation_status()` exists, is tested, and refuses a
partner and an out-of-market KAM. No console screen calls it yet — today a KAM
moves a ticket from the SQL editor. That is the obvious next piece of console
work and it is a screen, not a schema change.

**Auto-escalation at 24h.** `ack_due_at` is stamped on insert and shown; nothing
watches the clock. It needs a scheduled job, which this deployment does not have.
