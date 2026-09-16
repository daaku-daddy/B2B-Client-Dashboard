# Platform usage analytics

**Covers:** `lib/analytics/**` — PRD §14.6

§4.3 is explicit that business KPIs are owned by the business and deliberately
not in the PRD. **Usage analytics is the only measurement track in scope for
v1**, and §14.6 makes it a build requirement rather than a reporting
afterthought: the instrumentation ships with the features.

## One wrapper, and the rule that makes it worth having

> "All three tools consume the same event definitions through a single frontend
> wrapper module. **No component calls a vendor SDK directly** — this is what
> makes swapping or adding a tool a one-file change rather than a rewrite."
> "Direct SDK calls fail code review."

`lib/analytics/track.ts` is the only file in this app allowed to know a vendor
exists. Everything else imports `track` and an `EV.*` constant and gets a type
error for anything else.

| File | Holds |
|---|---|
| `events.ts` | The taxonomy from §14.6.4, verbatim, with the question each event answers in a comment. The super-property shape from §14.6.3. `stripPII()`. |
| `track.ts` | `identify()`, `track()`, `hoverProbe()`, `friction.*`, and `sendToVendors()` — the one function that will ever touch an SDK. |
| `Analytics.tsx` | Mounted once in the partner shell. Identifies the session, fires `session_start` and a per-route view event. |

## What it does with no keys configured

Nothing is wired to a vendor on this deployment — no Mixpanel token, no Clarity
id. That is deliberate rather than unfinished. §14.6.6 says the tracking plan
comes first and every event must answer a question; `events.ts` *is* that plan.
With no key set, `track()` queues into `window.__mdEvents`, so the event QA
checklist in §14.6.6 — fires once, fires on the right trigger, carries all
required properties, carries no PII — can be run against a staging build today,
before any vendor sees a byte.

Adding Mixpanel later is `sendToVendors()` and a script tag. One function, one
file. That is the entire point of the wrapper.

## Three things that are enforced, not conventions

**No PII, ever** (§14.6.7). `stripPII()` drops any property whose key looks like
a name, phone, email, address, GST or PAN, and any value that is a bare ten-digit
Indian mobile. A runtime check and not only a rule, because the rule is what
fails: one `{ client_name }` in one handler is a DPDP problem nobody notices
until it is in a vendor's warehouse and cannot be recalled.

**Internal traffic is excluded by default** (§14.6.7). `is_internal` is dropped
inside `sendToVendors()`, not filtered in a dashboard. A default that lives in a
report filter is one somebody forgets to apply.

**The group key is `org_id`** (§14.6.3). The unit of analysis is the firm, not
the individual — three designers at one studio logging in twice is one active
firm. Mixpanel Group Analytics has to be configured on this key at
implementation, not retrofitted.

## Hovers

Hovers are **not** sent as events; volume would swamp the pipeline and the bill,
and hover intent is Clarity's job. §14.6.4 names three exceptions, each with a
1-second dwell and 10% sampling, because each tells us where curiosity exists
without conversion:

- hover on a SKU chip without clicking
- hover on a locked reward tier
- hover on a masked phone number

`hoverProbe()` refuses anything not on that list, at compile time and at runtime.
"Just this one more hover" is how the pipeline drowns.

## Naming

`object_action`, lower snake case, past tense. `referral_submitted`, never
`Submit Referral` or `referralSent`. No event ships without an entry in
`events.ts`, and no entry exists without a question it answers — that second half
is what prevents the 400-event graveyard.

## Not built

- No vendor is connected. See above; this is a deliberate gap, not a stub.
- **Server-side events.** Everything here is browser-side. A referral submitted
  from a server action fires its event from the client that called it, which is
  fine today and would not be if a sync ever created referrals on a partner's
  behalf.
- **The org engagement score** (§14.6.5) is Phase 2 and belongs in the CRM, not
  here — §14.6.5 is explicit that it must be surfaced to the KAM inside the CRM
  "not buried in an analytics tool the field team will never open".
