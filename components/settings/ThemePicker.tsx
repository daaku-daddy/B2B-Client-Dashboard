'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Check, RotateCcw } from 'lucide-react'
import type { Partner } from '@/lib/domain/types'
import { Button, Card, CardHead, Field, Input, Problem } from '@/components/ui'
import { checkTheme, cssVariables, PRESETS, resolveTheme } from '@/lib/domain/theme'
import { updateStudioProfile } from '@/lib/data/actions'
import { EV, track } from '@/lib/analytics/track'

/**
 * §13.3 — theme customisation, with live preview and the AA gate.
 *
 * "Enforce WCAG AA contrast, rejecting or auto-adjusting combinations that
 * fail." This rejects, visibly, before save — a partner who pastes their brand
 * yellow gets the measured ratio and a sentence, not a silently substituted
 * colour they will notice a week later and report as a bug.
 *
 * The preview is the real thing: `cssVariables()` is the same function the app
 * shell uses, applied to a scoped div. A preview drawn with its own swatches
 * would be a second implementation of the palette and would eventually disagree
 * with the workspace it is previewing.
 */
export function ThemePicker({ partner }: { partner: Partner }) {
  const router = useRouter()
  const [preset, setPreset] = useState(partner.theme_preset ?? 'default')
  const [primary, setPrimary] = useState(partner.theme_primary ?? '')
  const [accent, setAccent] = useState(partner.theme_accent ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [pending, start] = useTransition()

  const check = primary.trim() ? checkTheme(primary) : null
  const preview = { theme_preset: preset, theme_primary: check?.ok ? primary : '', theme_accent: accent }
  const resolved = resolveTheme(preview)

  function save(next?: { preset?: string; primary?: string; accent?: string }) {
    setError(null)
    setSaved(false)
    const p = next?.preset ?? preset
    const pr = next?.primary ?? primary
    const ac = next?.accent ?? accent
    if (pr.trim() && !checkTheme(pr).ok) {
      return setError('That colour is too light for white text to sit on. Pick something darker, or use a preset.')
    }
    start(async () => {
      const res = await updateStudioProfile({ theme_preset: p, theme_primary: pr, theme_accent: ac })
      if (!res.ok) return setError(res.error)
      track(EV.theme_changed, { preset: p, custom: Boolean(pr.trim()) })
      setSaved(true)
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHead
        title="How it looks"
        hint="Navigation, buttons, chips and charts pick this up. The page itself stays neutral so everything stays readable — and success, warning and error keep their own colours, always."
      />
      <div className="space-y-4 px-4 py-4">
        {error ? <Problem title="Not applied" detail={error} /> : null}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => {
                setPreset(p.key)
                setPrimary('')
                setAccent('')
                save({ preset: p.key, primary: '', accent: '' })
              }}
              className={[
                'flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs font-medium transition',
                preset === p.key && !primary
                  ? 'border-ink-soft bg-raised text-ink'
                  : 'border-line bg-surface text-ink-soft hover:border-line-strong',
              ].join(' ')}
            >
              <span className="flex shrink-0 gap-0.5">
                <span className="size-3.5 rounded-full" style={{ background: p.primary }} />
                <span className="size-3.5 rounded-full" style={{ background: p.accent }} />
              </span>
              <span className="truncate">{p.label}</span>
              {preset === p.key && !primary ? <Check size={12} className="ml-auto shrink-0 text-good" /> : null}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Your own primary colour" hint="A hex code, e.g. #2d5a44. Leave blank to use the preset.">
            <Input value={primary} onChange={(e) => setPrimary(e.target.value)} placeholder="#2d5a44" />
          </Field>
          <Field label="Accent" hint="Used for highlights and the coin colours.">
            <Input value={accent} onChange={(e) => setAccent(e.target.value)} placeholder="#8a7a4e" />
          </Field>
        </div>

        {/* The AA gate, stated as a measurement. "Too light" on its own reads
            as a matter of taste; "3.1:1, and buttons need 4.5:1" reads as a
            standard, which is what it is. */}
        {check && !check.ok ? (
          <p className="flex items-start gap-2 rounded-lg border border-bad-soft bg-bad-soft px-3 py-2 text-xs leading-relaxed text-ink">
            <AlertTriangle size={13} className="mt-0.5 shrink-0 text-bad" />
            <span>
              {check.reason === 'unparseable' ? (
                <>That is not a hex colour. Try something like <code>#2d5a44</code>.</>
              ) : (
                <>
                  White text on {primary} measures <strong>{check.contrast}:1</strong>, and a button label needs{' '}
                  <strong>{check.needed}:1</strong> to be readable. Something darker will pass — we would rather say so
                  than ship you a workspace whose buttons cannot be read.
                </>
              )}
            </span>
          </p>
        ) : null}

        <div>
          <p className="mb-1.5 text-xs font-medium text-ink-soft">Preview</p>
          <div className="rounded-lg border border-line p-3">
            <div style={parseStyle(cssVariables(preview))}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-lg px-3 py-1.5 text-sm font-medium text-white" style={{ background: resolved.primary }}>
                  Send the quote
                </span>
                <span
                  className="rounded-md border px-1.5 py-0.5 text-[11px] font-medium"
                  style={{ background: tint(resolved.primary), color: resolved.primary, borderColor: tint(resolved.primary, 0.72) }}
                >
                  Counted
                </span>
                <span className="rounded-md border border-transparent bg-good-soft px-1.5 py-0.5 text-[11px] font-medium text-good">
                  Confirmed
                </span>
                <span className="rounded-md border border-transparent bg-bad-soft px-1.5 py-0.5 text-[11px] font-medium text-bad">
                  Reversed
                </span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-line">
                <div className="h-full w-2/3 rounded-full" style={{ background: resolved.primary }} />
              </div>
            </div>
          </div>
          <p className="mt-1.5 text-[11px] text-ink-faint">
            Confirmed and Reversed keep their own colours whatever you pick. A theme that could recolour those could
            make a reversal look like a payment.
          </p>
        </div>

        <div className="flex items-center justify-end gap-3">
          {saved ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-good">
              <Check size={13} /> Applied
            </span>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setPreset('default')
              setPrimary('')
              setAccent('')
              save({ preset: 'default', primary: '', accent: '' })
            }}
            disabled={pending}
          >
            <RotateCcw size={14} /> Reset
          </Button>
          <Button type="button" variant="primary" onClick={() => save()} disabled={pending}>
            {pending ? 'Applying…' : 'Apply'}
          </Button>
        </div>
      </div>
    </Card>
  )
}

/** `--a:b;--c:d` → a React style object. */
function parseStyle(css: string): React.CSSProperties {
  const out: Record<string, string> = {}
  for (const pair of css.split(';')) {
    const i = pair.indexOf(':')
    if (i > 0) out[pair.slice(0, i)] = pair.slice(i + 1)
  }
  return out as React.CSSProperties
}

function tint(hex: string, amount = 0.92): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return hex
  const n = parseInt(m[1], 16)
  const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.round(c + (255 - c) * amount))
  return `#${rgb.map((c) => c.toString(16).padStart(2, '0')).join('')}`
}
