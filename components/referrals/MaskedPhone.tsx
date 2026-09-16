'use client'

import { useState, useTransition } from 'react'
import { Eye, Loader2 } from 'lucide-react'
import { maskPhone } from '@/lib/domain/privacy'
import { revealPhone } from '@/lib/data/actions'
import { EV, hoverProbe, track } from '@/lib/analytics/track'

/**
 * §14.5 — "Display as 98XXXXXX21 by default with a reveal action that is
 * LOGGED."
 *
 * The log is what makes the mask a control rather than decoration, so the number
 * is fetched from the server by `revealPhone()` AFTER the log row is written —
 * it is not sitting in the DOM behind a CSS blur waiting for anyone who opens
 * dev tools. A reveal that is displayed but not recorded is precisely the reveal
 * somebody would want.
 *
 * The hover probe is one of §14.6.4's three deliberate exceptions to "hovers are
 * not events": hovering a masked number without clicking reveal is curiosity
 * without conversion, and it is the signal that tells us whether masking is
 * getting in the way of real work or doing its job quietly.
 */
export function MaskedPhone({
  referralId,
  phone,
  surface,
  className,
}: {
  referralId: string
  phone: string
  surface: string
  className?: string
}) {
  const [shown, setShown] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  if (shown) {
    return (
      <a href={`tel:${shown}`} className={`tnum text-brand hover:underline ${className ?? ''}`}>
        {shown}
      </a>
    )
  }

  return (
    <span className={`inline-flex items-center gap-1.5 ${className ?? ''}`}>
      <span className="tnum text-ink-soft" {...hoverProbe(EV.masked_phone_hovered, { surface })}>
        {maskPhone(phone)}
      </span>
      <button
        type="button"
        disabled={pending}
        title="Show the full number. We record that you did — see the privacy note on this page."
        onClick={(e) => {
          e.stopPropagation()
          setError(null)
          start(async () => {
            const r = await revealPhone(referralId, surface)
            if (!r.ok) return setError(r.error)
            setShown(r.data)
            track(EV.journey_event_expanded, { surface, kind: 'phone_reveal' })
          })
        }}
        className="rounded p-0.5 text-ink-faint transition hover:bg-raised hover:text-brand disabled:opacity-50"
      >
        {pending ? <Loader2 size={12} className="animate-spin" /> : <Eye size={12} />}
      </button>
      {error ? <span className="text-[10px] text-bad">{error}</span> : null}
    </span>
  )
}
