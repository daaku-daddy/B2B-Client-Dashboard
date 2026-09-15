'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Send } from 'lucide-react'
import { Button, Card, CardHead, Field, Input, Problem, Select, Textarea } from '@/components/ui'
import { createApplication } from '@/lib/data/console-actions'
import { MARKETS, guessMarket } from '@/lib/domain/markets'
import type { OutreachProspect, StaffUser } from '@/lib/domain/types'

/**
 * The form an outreach manager fills after the meeting.
 *
 * Filing it does NOT create a login. It creates a record an admin reads and
 * verifies, and only then are credentials generated — which is the whole point
 * of the step, so the form says so rather than leaving someone waiting for a
 * welcome email that is not coming.
 *
 * Five fields are genuinely required and the rest are not, because a form that
 * demands a GST number from a two-person practice gets filled with a fake one.
 * The mobile number is required and is validated hard: it is the exact key every
 * order this firm ever refers is matched on, and a wrong one is a firm whose
 * orders silently never appear.
 */
export function ApplicationForm({
  kams,
  defaultMarket,
  prospect,
}: {
  kams: StaffUser[]
  defaultMarket: string | null
  prospect: OutreachProspect | null
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const market = prospect?.market ?? defaultMarket ?? guessMarket(prospect?.city) ?? ''

  function submit(form: FormData) {
    setError(null)
    start(async () => {
      const res = await createApplication({
        firm_name: String(form.get('firm_name') ?? ''),
        contact_name: String(form.get('contact_name') ?? ''),
        phone: String(form.get('phone') ?? ''),
        email: String(form.get('email') ?? ''),
        city: String(form.get('city') ?? ''),
        market: String(form.get('market') ?? '') || null,
        firm_type: String(form.get('firm_type') ?? 'architect'),
        gst: String(form.get('gst') ?? ''),
        team_size: String(form.get('team_size') ?? ''),
        typical_projects: String(form.get('typical_projects') ?? ''),
        met_on: String(form.get('met_on') ?? '') || null,
        meeting_notes: String(form.get('meeting_notes') ?? ''),
        source: String(form.get('source') ?? 'outreach'),
        proposed_kam: String(form.get('proposed_kam') ?? '') || null,
        prospect_id: prospect?.id ?? null,
      })
      if (!res.ok) return setError(res.error)
      router.push('/console/applications')
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHead
        title={prospect ? `Onboard ${prospect.firm_name}` : 'Onboard a firm'}
        hint="Filing this does not create a login. An admin reads it, verifies the details, and then issues the credentials for you to send."
      />
      <form action={submit} className="space-y-4 px-4 py-4">
        {error ? <Problem title="That did not file" detail={error} /> : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Firm / studio name" required>
            <Input name="firm_name" defaultValue={prospect?.firm_name ?? ''} required />
          </Field>
          <Field label="Who you met" required>
            <Input name="contact_name" defaultValue={prospect?.contact_name ?? ''} required />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Mobile number"
            required
            hint="Ten digits. Every order this firm refers is matched on this exactly — a wrong number is a firm whose orders never show up."
          >
            <Input name="phone" defaultValue={prospect?.phone ?? ''} inputMode="numeric" required placeholder="9876543210" />
          </Field>
          <Field label="Email" required hint="This becomes their login.">
            <Input type="email" name="email" defaultValue={prospect?.email ?? ''} required />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="City">
            <Input name="city" defaultValue={prospect?.city ?? ''} />
          </Field>
          <Field label="Market" required hint="Decides whose list they land on.">
            <Select name="market" defaultValue={market} required>
              <option value="">Pick one</option>
              {MARKETS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
            </Select>
          </Field>
          <Field label="They are">
            <Select name="firm_type" defaultValue={prospect?.firm_type ?? 'architect'}>
              <option value="architect">An architect</option>
              <option value="interior_designer">An interior designer</option>
              <option value="design_build">A design &amp; build firm</option>
              <option value="contractor">A contractor</option>
              <option value="other">Something else</option>
            </Select>
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Key account manager" hint="Who will look after them.">
            <Select name="proposed_kam" defaultValue="">
              <option value="">Decide later</option>
              {kams.map((k) => (
                <option key={k.user_id} value={k.user_id}>
                  {k.name}{k.market ? ` · ${k.market}` : ''}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="How they came to us">
            <Select name="source" defaultValue="outreach">
              <option value="outreach">Outreach</option>
              <option value="inbound">Inbound enquiry</option>
              <option value="walk_in">Walked into a store</option>
              <option value="partner_referral">Referred by another partner</option>
              <option value="existing_client">Already buying from us</option>
              <option value="other">Something else</option>
            </Select>
          </Field>
          <Field label="Met on">
            <Input type="date" name="met_on" />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Team size">
            <Select name="team_size" defaultValue="">
              <option value="">Not asked</option>
              <option value="1-3">1–3</option>
              <option value="4-10">4–10</option>
              <option value="11-25">11–25</option>
              <option value="25+">25+</option>
            </Select>
          </Field>
          <Field label="GSTIN" hint="Optional. A sole practice often has none." className="sm:col-span-2">
            <Input name="gst" />
          </Field>
        </div>

        <Field label="What they typically work on">
          <Input name="typical_projects" placeholder="Residential interiors, 1500–3000 sqft villas" />
        </Field>

        <Field
          label="What came out of the meeting"
          hint="Read by whoever verifies this and by their KAM afterwards. What they buy today, what they were wary of, what you promised."
        >
          <Textarea name="meeting_notes" rows={4} />
        </Field>

        <div className="flex justify-end gap-2 border-t border-line pt-3">
          <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={pending}>
            <Send size={14} /> {pending ? 'Filing…' : 'File for verification'}
          </Button>
        </div>
      </form>
    </Card>
  )
}
