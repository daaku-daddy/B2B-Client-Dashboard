'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/client'
import { Button, Card, Field, Input, Problem, Select } from '@/components/ui'
import { phone10 } from '@/lib/format'

/**
 * Sign in / sign up.
 *
 * Email + password, not phone OTP. Material Depot's own login is phone + OTP
 * (`/api/login-otp` → `/api/verify-otp`, four digits) and that is the right
 * long-term login here too — same identity as the storefront, so a partner's
 * referrals and wishlist tie to one account. It needs the OTP endpoints
 * allowlisted for this domain, which is a backend change, so this ships with
 * email + password and takes the partner's phone at sign-up as the join key
 * instead. Swapping the login later does not touch any other table.
 */
export default function LoginPage() {
  // useSearchParams needs a boundary, and this page prerenders.
  return (
    <Suspense fallback={<main className="min-h-dvh bg-ground" />}>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const next = params.get('next') || '/dashboard'

  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firm, setFirm] = useState('')
  const [contact, setContact] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [firmType, setFirmType] = useState('architect')

  async function signIn(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const sb = supabaseBrowser()
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password })
    if (error) {
      setError(error.message)
      setBusy(false)
      return
    }
    router.replace(next)
    router.refresh()
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)

    const ten = phone10(phone)
    if (!ten) {
      setError(
        'Enter a 10-digit Indian mobile number. This is the number Material Depot matches your referrals and orders against, so it has to be exact.',
      )
      return
    }
    if (!firm.trim() || !contact.trim()) {
      setError('Firm name and your name are both needed.')
      return
    }

    setBusy(true)
    const sb = supabaseBrowser()
    const { data, error: authErr } = await sb.auth.signUp({ email: email.trim(), password })
    if (authErr) {
      setError(authErr.message)
      setBusy(false)
      return
    }

    // Email confirmation on means there is no session yet, so the firm cannot
    // be created in this request. Say that plainly instead of failing silently.
    if (!data.session) {
      setNotice('Check your email to confirm the address, then sign in — we will set your firm up on first sign-in.')
      window.localStorage.setItem(
        'pending_firm',
        JSON.stringify({ firm, contact, phone: ten, city, firmType }),
      )
      setBusy(false)
      setMode('in')
      return
    }

    const { error: rpcErr } = await sb.rpc('onboard_partner', {
      p_firm_name: firm.trim(),
      p_contact_name: contact.trim(),
      p_phone: ten,
      p_email: email.trim(),
      p_city: city.trim() || null,
      p_firm_type: firmType,
      p_gst: null,
    })
    if (rpcErr) {
      setError(`Signed in, but the firm could not be created: ${rpcErr.message}`)
      setBusy(false)
      return
    }
    router.replace('/dashboard')
    router.refresh()
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-ground px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <p className="font-display text-2xl font-semibold tracking-tight text-ink">
            Material Depot <span className="text-brand">for Partners</span>
          </p>
          <p className="mt-1.5 text-sm text-ink-soft">
            Design it, quote it, procure it — and get paid for what your clients buy.
          </p>
        </div>

        <Card className="p-5">
          <div className="mb-4 flex gap-1 rounded-lg bg-raised p-1">
            {(['in', 'up'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setError(null) }}
                className={`h-8 flex-1 rounded-md text-sm font-medium transition ${
                  mode === m ? 'bg-surface text-ink shadow-sm' : 'text-ink-faint hover:text-ink-soft'
                }`}
              >
                {m === 'in' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>

          {error ? <div className="mb-3"><Problem title="That did not work" detail={error} /></div> : null}
          {notice ? (
            <div className="mb-3 rounded-[var(--radius-card)] border border-info-soft bg-info-soft px-3 py-2 text-xs text-ink-soft">
              {notice}
            </div>
          ) : null}

          <form onSubmit={mode === 'in' ? signIn : signUp} className="space-y-3">
            {mode === 'up' ? (
              <>
                <Field label="Firm / studio name" required>
                  <Input value={firm} onChange={(e) => setFirm(e.target.value)} placeholder="Studio Terra" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Your name" required>
                    <Input value={contact} onChange={(e) => setContact(e.target.value)} />
                  </Field>
                  <Field label="City">
                    <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Bengaluru" />
                  </Field>
                </div>
                <Field
                  label="Mobile number"
                  required
                  hint="Your referrals and incentive are matched on this number, exactly. 10 digits."
                >
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    inputMode="numeric"
                    placeholder="9876543210"
                  />
                </Field>
                <Field label="You are">
                  <Select value={firmType} onChange={(e) => setFirmType(e.target.value)}>
                    <option value="architect">An architect</option>
                    <option value="interior_designer">An interior designer</option>
                    <option value="design_build">A design &amp; build firm</option>
                    <option value="contractor">A contractor</option>
                    <option value="other">Something else</option>
                  </Select>
                </Field>
              </>
            ) : null}

            <Field label="Email" required>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </Field>
            <Field label="Password" required hint={mode === 'up' ? 'At least 8 characters.' : undefined}>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
                minLength={8}
              />
            </Field>

            <Button type="submit" variant="primary" className="w-full" disabled={busy}>
              {busy ? 'One moment…' : mode === 'in' ? 'Sign in' : 'Create my workspace'}
            </Button>
          </form>
        </Card>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-ink-faint">
          Your clients, projects and margins are visible only to your firm.
        </p>
      </div>
    </main>
  )
}
