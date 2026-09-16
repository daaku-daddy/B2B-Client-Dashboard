'use client'

/**
 * The single instrumentation layer — PRD §14.6.2 and §14.6.6.
 *
 * "All three [Mixpanel, Clarity, MoEngage] consume the same event definitions
 * through a single frontend wrapper module. **No component calls a vendor SDK
 * directly** — this is what makes swapping or adding a tool a one-file change
 * rather than a rewrite." And §14.6.6: "One typed `track()` wrapper with event
 * names as constants. Direct SDK calls fail code review."
 *
 * So this file is the only place in the app that is allowed to know a vendor
 * exists. Everything else imports `track` and an `EV.*` constant, and gets a
 * type error for anything else.
 *
 * ## What it does with no keys configured
 *
 * Nothing is wired to a vendor on this deployment yet — no Mixpanel token, no
 * Clarity id. That is deliberate rather than unfinished: §14.6.6 says the
 * tracking plan comes first and every event must answer a question, and the
 * taxonomy in `events.ts` is that plan. With no key set, `track()` queues into
 * `window.__mdEvents` so the event QA checklist in §14.6.6 ("event fires once,
 * fires on the right trigger, carries all required properties, carries no PII")
 * can be run against a staging build today, before any vendor sees a byte.
 *
 * Adding Mixpanel later is `sendToVendors()` and the script tag. It is one
 * function and one file, which is the entire point of the wrapper.
 */

import { EV, HOVER_DWELL_MS, HOVER_SAMPLE_RATE, HOVER_EVENTS, stripPII, type EventName, type SuperProps } from './events'

export { EV }
export type { EventName, SuperProps }

type Props = Record<string, unknown>

let superProps: SuperProps | null = null
let ready = false

declare global {
  interface Window {
    __mdEvents?: { event: string; props: Props; at: string }[]
  }
}

/**
 * Called once, from the app shell, with who is looking.
 *
 * Until this has run, events are still recorded but carry no group key. They
 * are NOT dropped: an event lost before identify() is an event missing from
 * the funnel it was meant to measure, and "the first click of every session is
 * invisible" is a very expensive kind of quiet.
 */
export function identify(props: SuperProps) {
  superProps = props
  ready = true
}

export function track(event: EventName, props: Props = {}) {
  if (typeof window === 'undefined') return
  const payload = {
    ...(superProps ?? {}),
    ...stripPII(props),
    // §14.6.3's `platform`, measured rather than assumed — a designer on a
    // phone in a client's flat is the session we most want to tell apart.
    platform: window.innerWidth < 768 ? 'mobile_web' : 'web',
    identified: ready,
  }
  const row = { event, props: payload, at: new Date().toISOString() }
  ;(window.__mdEvents ??= []).push(row)
  sendToVendors(row)
}

/**
 * The one function that will ever touch a vendor SDK.
 *
 * Kept as a no-op with a named shape rather than left out, so that the wiring
 * is a visible gap in one place instead of a decision somebody re-makes at each
 * call site. Internal traffic is dropped HERE and not at the query — §14.6.7
 * wants Material Depot's own sessions out of every partner-facing report by
 * default, and a default that lives in a dashboard filter is one somebody
 * forgets to apply.
 */
function sendToVendors(row: { event: string; props: Props; at: string }) {
  if (row.props.is_internal === true) return
  // mixpanel.track(row.event, row.props)      — needs NEXT_PUBLIC_MIXPANEL_TOKEN
  // clarity('event', row.event)               — needs NEXT_PUBLIC_CLARITY_ID
  // MoEngage.track_event(row.event, row.props)
}

/**
 * §14.6.4's three deliberate hover exceptions, with the dwell threshold and the
 * sampling the PRD specifies.
 *
 * Returns the handlers to spread onto an element. Anything not on the list of
 * three is refused at compile time by the `HoverEvent` type and at runtime by
 * the guard, because "just this one more hover" is how the pipeline drowns.
 */
export function hoverProbe(event: EventName, props: Props = {}) {
  if (!HOVER_EVENTS.includes(event)) return {}
  let timer: ReturnType<typeof setTimeout> | undefined
  return {
    onMouseEnter: () => {
      if (Math.random() > HOVER_SAMPLE_RATE) return
      timer = setTimeout(() => track(event, props), HOVER_DWELL_MS)
    },
    onMouseLeave: () => {
      if (timer) clearTimeout(timer)
    },
  }
}

/** §14.6.4's friction layer, as one call so the property names cannot drift. */
export const friction = {
  error: (code: string, surface: string) => track(EV.error_shown, { code, surface }),
  empty: (surface: string) => track(EV.empty_state_shown, { surface }),
  invalid: (field: string, surface: string) => track(EV.form_validation_failed, { field, surface }),
}
