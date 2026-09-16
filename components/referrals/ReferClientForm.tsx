'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle2, Info, Loader2 } from 'lucide-react'
import type { Client } from '@/lib/domain/types'
import { Button, Field, Input, Problem, Select, Textarea } from '@/components/ui'
import { checkReferralPhone, createReferral, type PhoneCheck } from '@/lib/data/actions'
import { EV, friction, track } from '@/lib/analytics/track'
import { phone10 } from '@/lib/format'

/**
 * §9.2 — Refer a client.
 *
 * Three things here are requirements rather than polish:
 *
 * **The duplicate check runs before submit.** "On phone entry, run a real-time
 * duplicate check… show an inline warning before submission — never let a
 * partner submit blind and get rejected later." A rejection two days later, by
 * email, for a client the partner has already told they are sorted, is how §18's
 * "attribution disputes damage relationships" actually happens.
 *
 * **The check has an `unknown` state and it is shown.** If the lookup itself
 * fails, this says the check could not run and lets the partner submit anyway. A
 * check that silently reports "clear" when it did not run is worse than no
 * check, because it is a promise.
 *
 * **Consent is a hard gate.** Everywhere else in Material Depot's apps a
 * "mandatory" field is soft-gated and logged — a blocked field stops real work
 * in a store. This one is different: it is the lawful basis under the DPDP Act
 * for showing one person's shopping to somebody else, and §14.5 names it as a
 * launch blocker for the journey view. The server refuses it too; this is only
 * the half the partner can see.
 */
const BUDGET_BANDS = ['Under ₹5 L', '₹5 – 15 L', '₹15 – 30 L', '₹30 – 50 L', 'Over ₹50 L']
const TIMELINES = ['Buying now', 'Within a month', '1–3 months', '3–6 months', 'Later / exploring']
const CATEGORIES = [
  'Tiles', 'Laminates', 'Veneers', 'Wooden flooring', 'Wallpaper',
  'Louvers & panels', 'Sanitaryware', 'Hardware', 'Kitchen', 'Lighting',
]

export function ReferClientForm({
  clients,
  onDone,
  onCancel,
}: {
  clients: Client[]
  onDone: () => void
  onCancel: () => void
}) {
  const router = useRouter()
  const [fromClient, setFromClient] = useState('')
  const [phone, setPhone] = useState('')
  const [check, setCheck] = useState<PhoneCheck | null>(null)
  const [checking, setChecking] = useState(false)
  const [consent, setConsent] = useState(false)
  const [categories, setCategories] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const [touched, setTouched] = useState<string | null>(null)

  const picked = clients.find((c) => c.id === fromClient)
  const effectivePhone = picked?.phone ?? phone

  function runCheck(raw: string) {
    const ten = phone10(raw)
    if (!ten) {
      setCheck(raw.replace(/\D/g, '').length >= 10 ? { state: 'invalid' } : null)
      return
    }
    setChecking(true)
    // Not debounced on a timer — fired when the field has ten valid digits,
    // which happens once. A keystroke debounce would fire this three or four
    // times per number for no extra information.
    checkReferralPhone(ten)
      .then(setCheck)
      .finally(() => setChecking(false))
  }

  function submit(form: FormData) {
    setError(null)
    if (!consent) {
      friction.invalid('consent', 'refer_client')
      return setError(
        'We need you to confirm the client is happy for us to contact them and share what they do with us. Without it we cannot show you their visits or their cart.',
      )
    }
    start(async () => {
      const res = await createReferral({
        client_id: picked?.id ?? null,
        client_name: picked?.name ?? String(form.get('client_name') ?? ''),
        md_phone: effectivePhone,
        email: String(form.get('email') ?? ''),
        city: String(form.get('city') ?? ''),
        locality: String(form.get('locality') ?? ''),
        project_type: (String(form.get('project_type') ?? '') || null) as 'residential' | 'commercial' | 'other' | null,
        budget_band: String(form.get('budget_band') ?? ''),
        timeline: String(form.get('timeline') ?? ''),
        categories,
        notes: String(form.get('notes') ?? ''),
        consent: true,
      })
      if (!res.ok) {
        friction.error('referral_create_failed', 'refer_client')
        return setError(res.error)
      }
      track(EV.referral_submitted, {
        has_email: Boolean(form.get('email')),
        category_count: categories.length,
        from_existing_client: Boolean(picked),
        duplicate_check: check?.state ?? 'not_run',
      })
      onDone()
      router.refresh()
    })
  }

  return (
    <form
      action={submit}
      onFocus={(e) => {
        const name = (e.target as HTMLElement).getAttribute('name')
        if (name) setTouched(name)
        if (!touched) track(EV.referral_started)
      }}
      className="space-y-3"
    >
      {error ? <Problem title="Could not save" detail={error} /> : null}

      {clients.length ? (
        <Field label="One of your clients" hint="Or leave this blank and type someone else in below.">
          <Select
            value={fromClient}
            onChange={(e) => {
              setFromClient(e.target.value)
              setCheck(null)
              const p = clients.find((c) => c.id === e.target.value)?.phone
              if (p) runCheck(p)
            }}
          >
            <option value="">Someone not on my client list</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id} disabled={!c.phone}>
                {c.name}
                {c.phone ? ` — ${c.phone}` : ' — no phone on file'}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      {!picked ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Client name" required>
            <Input name="client_name" autoComplete="off" />
          </Field>
          <Field
            label="Their mobile number"
            required
            hint="10 digits, exactly as they will give it in store. It is the only thing that links their orders back to you."
          >
            <Input
              name="md_phone"
              inputMode="numeric"
              placeholder="9876543210"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value)
                setCheck(null)
              }}
              onBlur={(e) => runCheck(e.target.value)}
            />
          </Field>
        </div>
      ) : (
        <div className="rounded-lg border border-line bg-raised px-3 py-2 text-xs text-ink-soft">
          Referring <strong className="text-ink">{picked.name}</strong> on <span className="tnum">{picked.phone}</span>.
          {!picked.phone ? (
            <span className="mt-1 block text-bad">
              This client has no phone number on file. Add one on their client record first — without it nothing can be
              credited to you.
            </span>
          ) : null}
        </div>
      )}

      <PhoneCheckNote check={check} checking={checking} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Email" hint="Optional. Helps us reach them if the number is busy.">
          <Input name="email" type="email" autoComplete="off" />
        </Field>
        <Field label="Project type">
          <Select name="project_type" defaultValue="residential">
            <option value="residential">Residential</option>
            <option value="commercial">Commercial</option>
            <option value="other">Something else</option>
          </Select>
        </Field>
        <Field label="City"><Input name="city" autoComplete="off" /></Field>
        <Field label="Locality" hint="Which part of town — it decides the store they will walk into.">
          <Input name="locality" autoComplete="off" />
        </Field>
        <Field label="Rough budget">
          <Select name="budget_band" defaultValue="">
            <option value="">Not sure yet</option>
            {BUDGET_BANDS.map((b) => <option key={b} value={b}>{b}</option>)}
          </Select>
        </Field>
        <Field label="When are they buying">
          <Select name="timeline" defaultValue="">
            <option value="">Not sure yet</option>
            {TIMELINES.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
        </Field>
      </div>

      <Field label="What they are after" hint="Tick anything that applies. It tells the store team what to have ready.">
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => {
            const on = categories.includes(c)
            return (
              <button
                key={c}
                type="button"
                onClick={() => setCategories((prev) => (on ? prev.filter((x) => x !== c) : [...prev, c]))}
                className={[
                  'rounded-full border px-2.5 py-1 text-xs font-medium transition',
                  on ? 'border-brand bg-brand-soft text-brand' : 'border-line bg-surface text-ink-soft hover:border-line-strong',
                ].join(' ')}
              >
                {c}
              </button>
            )
          })}
        </div>
      </Field>

      <Field label="Anything your key account manager should know">
        <Textarea name="notes" rows={2} />
      </Field>

      {/* §14.5's consent basis. Deliberately worded as what it actually is,
          rather than as a tick-box: the partner is being asked to confirm
          something about a third party, and a vague label here is what makes it
          meaningless later. */}
      <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-line bg-raised px-3 py-2.5">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 size-4 shrink-0 accent-[var(--color-brand)]"
        />
        <span className="text-xs leading-relaxed text-ink-soft">
          <strong className="text-ink">This client is happy for Material Depot to contact them</strong>, and for us to
          show you what they do with us — the stores they visit, what is in their cart and what they order. We will
          confirm this with them directly too. Until they confirm it, you will see whether they visited and whether they
          ordered, and nothing itemised.
        </span>
      </label>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={pending || check?.state === 'yours'}>
          {pending ? 'Saving…' : 'Refer them'}
        </Button>
      </div>
    </form>
  )
}

/**
 * The inline warning §9.2 asks for.
 *
 * What it does NOT say, in the `taken` case, is who holds the number. That is
 * another firm's client list, and `referral_phone_taken()` in the database
 * answers one bit for exactly this reason.
 */
function PhoneCheckNote({ check, checking }: { check: PhoneCheck | null; checking: boolean }) {
  if (checking) {
    return (
      <p className="inline-flex items-center gap-1.5 text-xs text-ink-faint">
        <Loader2 size={12} className="animate-spin" /> Checking that number…
      </p>
    )
  }
  if (!check) return null

  if (check.state === 'free') {
    return (
      <p className="inline-flex items-center gap-1.5 text-xs text-good">
        <CheckCircle2 size={13} /> That number is clear — nobody has referred them.
      </p>
    )
  }
  if (check.state === 'yours') {
    return (
      <Note tone="warn">
        You have already referred this number{check.clientName ? ` as ${check.clientName}` : ''}. Open that referral to
        see where it has got to rather than creating a second one.
      </Note>
    )
  }
  if (check.state === 'taken') {
    return (
      <Note tone="warn">
        Another firm has already referred this number, so we could not credit their orders to you. If you believe that
        is wrong, your key account manager can take it to a Material Depot admin — the first approved claim holds the
        attribution until an admin decides otherwise.
      </Note>
    )
  }
  if (check.state === 'invalid') {
    return <Note tone="bad">That is not a ten-digit Indian mobile number. Orders are matched on it exactly.</Note>
  }
  return (
    <Note tone="warn">
      We could not run the duplicate check just now, so we do not know whether this number is already spoken for. You
      can still submit — we would rather tell you the check did not run than tell you it came back clear.
    </Note>
  )
}

function Note({ tone, children }: { tone: 'warn' | 'bad'; children: React.ReactNode }) {
  return (
    <p
      className={[
        'flex items-start gap-1.5 rounded-lg border px-2.5 py-2 text-xs leading-relaxed',
        tone === 'bad' ? 'border-bad-soft bg-bad-soft text-ink' : 'border-warn-soft bg-warn-soft text-ink',
      ].join(' ')}
    >
      {tone === 'bad' ? (
        <AlertTriangle size={13} className="mt-0.5 shrink-0 text-bad" />
      ) : (
        <Info size={13} className="mt-0.5 shrink-0 text-warn" />
      )}
      <span>{children}</span>
    </p>
  )
}
