'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/client'
import { Button, Card, Field, Input, Problem, Select } from '@/components/ui'
import { phone10 } from '@/lib/format'

/**
 * Signed in, but no firm yet. This happens when email confirmation is on: the
 * sign-up form had no session to create the firm with, so it stashed the answers
 * and this picks them up on first real sign-in. It also stands on its own for
 * anyone whose firm creation failed the first time.
 */
export function Onboarding({ email }: { email: string | null }) {
  const router = useRouter()
  const [firm, setFirm] = useState('')
  const [contact, setContact] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [firmType, setFirmType] = useState('architect')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('pending_firm')
      if (!raw) return
      const p = JSON.parse(raw) as Record<string, string>
      setFirm(p.firm ?? '')
      setContact(p.contact ?? '')
      setPhone(p.phone ?? '')
      setCity(p.city ?? '')
      setFirmType(p.firmType ?? 'architect')
    } catch {
      // A corrupt stash is not worth a message — the form is still usable empty.
    }
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const ten = phone10(phone)
    if (!ten) return setError('A 10-digit Indian mobile number is needed — it is the key your referrals are matched on.')
    if (!firm.trim() || !contact.trim()) return setError('Firm name and your name are both needed.')

    setBusy(true)
    const { error } = await supabaseBrowser().rpc('onboard_partner', {
      p_firm_name: firm.trim(),
      p_contact_name: contact.trim(),
      p_phone: ten,
      p_email: email,
      p_city: city.trim() || null,
      p_firm_type: firmType,
      p_gst: null,
    })
    if (error) {
      setError(error.message)
      setBusy(false)
      return
    }
    window.localStorage.removeItem('pending_firm')
    router.replace('/dashboard')
    router.refresh()
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-ground px-4 py-10">
      <div className="w-full max-w-md">
        <h1 className="mb-1 font-display text-xl font-semibold tracking-tight text-ink">
          One last thing — tell us about your studio
        </h1>
        <p className="mb-5 text-sm text-ink-soft">
          This sets up your workspace. Nobody outside your firm sees what goes in it.
        </p>
        <Card className="p-5">
          {error ? <div className="mb-3"><Problem title="Could not set the firm up" detail={error} /></div> : null}
          <form onSubmit={submit} className="space-y-3">
            <Field label="Firm / studio name" required>
              <Input value={firm} onChange={(e) => setFirm(e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Your name" required>
                <Input value={contact} onChange={(e) => setContact(e.target.value)} />
              </Field>
              <Field label="City">
                <Input value={city} onChange={(e) => setCity(e.target.value)} />
              </Field>
            </div>
            <Field label="Mobile number" required hint="Matched exactly against Material Depot's records.">
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="numeric" />
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
            <Button type="submit" variant="primary" className="w-full" disabled={busy}>
              {busy ? 'Setting up…' : 'Open my workspace'}
            </Button>
          </form>
        </Card>
      </div>
    </main>
  )
}
