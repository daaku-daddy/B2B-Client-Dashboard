'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Lock } from 'lucide-react'
import type { NotificationPref } from '@/lib/domain/types'
import { Button, Card, CardHead, Problem } from '@/components/ui'
import { saveNotificationPrefs } from '@/lib/data/actions'
import { EV, track } from '@/lib/analytics/track'

/**
 * §13.4 — per-channel toggles per event class.
 *
 * Two rules the PRD is explicit about and that shape the whole component:
 *
 * **"Transactional and legal notices are non-optional."** They are not rendered
 * here at all. A greyed-out row a partner cannot switch off is an invitation to
 * try; absence is the honest representation of something that is not a choice.
 * The line at the bottom says what those are, so nobody is surprised.
 *
 * **A missing row means everything is on.** A firm that has never opened this
 * page should still be told their cashback was confirmed, so the default is
 * opt-out and not opt-in — and that is `?? true` below rather than a migration
 * that writes a row for every firm.
 */
const CLASSES = [
  { key: 'referrals', label: 'Referral decisions', detail: 'When we approve or decline a client you referred' },
  { key: 'orders', label: 'Order attribution', detail: 'When an order is verified as counting towards you' },
  { key: 'rewards', label: 'Slabs and rewards', detail: 'Slab reached, month closed, cashback confirmed' },
  { key: 'escalations', label: 'Escalations', detail: 'Acknowledged, progressed, resolved' },
  { key: 'portfolio', label: 'Portfolio decisions', detail: 'Published, or changes needed' },
  { key: 'kam', label: 'Messages from your KAM', detail: 'Nudges and account updates' },
] as const

const CHANNELS = [
  { key: 'in_app', label: 'In app' },
  { key: 'email', label: 'Email' },
  { key: 'whatsapp', label: 'WhatsApp' },
] as const

type Prefs = Record<string, { in_app?: boolean; email?: boolean; whatsapp?: boolean }>

export function NotificationPrefs({ pref }: { pref: NotificationPref | null }) {
  const router = useRouter()
  const [prefs, setPrefs] = useState<Prefs>(pref?.prefs ?? {})
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [pending, start] = useTransition()

  const on = (cls: string, ch: string) => (prefs[cls] as Record<string, boolean | undefined>)?.[ch] ?? true

  function toggle(cls: string, ch: string) {
    setSaved(false)
    setPrefs((p) => ({ ...p, [cls]: { ...p[cls], [ch]: !on(cls, ch) } }))
  }

  return (
    <Card>
      <CardHead title="What we tell you about" hint="And how. Everything is on unless you turn it off." />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr>
              <th className="border-b border-line px-4 py-2 text-left text-[11px] font-semibold tracking-wide text-ink-faint uppercase">
                Tell me when
              </th>
              {CHANNELS.map((c) => (
                <th
                  key={c.key}
                  className="border-b border-line px-3 py-2 text-center text-[11px] font-semibold tracking-wide text-ink-faint uppercase"
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CLASSES.map((cls) => (
              <tr key={cls.key}>
                <td className="border-b border-line px-4 py-2.5">
                  <div className="text-sm font-medium text-ink">{cls.label}</div>
                  <div className="text-[11px] text-ink-faint">{cls.detail}</div>
                </td>
                {CHANNELS.map((ch) => (
                  <td key={ch.key} className="border-b border-line px-3 py-2.5 text-center">
                    <input
                      type="checkbox"
                      checked={on(cls.key, ch.key)}
                      onChange={() => toggle(cls.key, ch.key)}
                      className="size-4 accent-[var(--color-brand)]"
                      aria-label={`${cls.label} by ${ch.label}`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
        <p className="inline-flex max-w-md items-start gap-1.5 text-[11px] leading-relaxed text-ink-faint">
          <Lock size={11} className="mt-0.5 shrink-0" />
          <span>
            Your login details, anything about the programme terms changing, and anything we are legally required to
            send you are not on this list and cannot be switched off.
          </span>
        </p>
        <div className="flex items-center gap-3">
          {error ? <Problem title="Not saved" detail={error} /> : null}
          {saved ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-good">
              <Check size={13} /> Saved
            </span>
          ) : null}
          <Button
            variant="primary"
            disabled={pending}
            onClick={() =>
              start(async () => {
                setError(null)
                const res = await saveNotificationPrefs(prefs)
                if (!res.ok) return setError(res.error)
                track(EV.notification_pref_changed)
                setSaved(true)
                router.refresh()
              })
            }
          >
            {pending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </Card>
  )
}
