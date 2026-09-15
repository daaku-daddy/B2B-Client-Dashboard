'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Check, KeyRound, Plus, ShieldCheck, X } from 'lucide-react'
import {
  Badge, Button, Card, CardHead, Empty, Field, Problem, Textarea, type Tone,
} from '@/components/ui'
import { Modal } from '@/components/ui/Modal'
import { CredentialsIssued } from './CredentialsIssued'
import { provisionFromApplication, reviewApplication, type IssuedCredentials } from '@/lib/data/console-actions'
import type { ApplicationStatus, PartnerApplication, StaffUser } from '@/lib/domain/types'
import { date } from '@/lib/format'
import { marketLabel } from '@/lib/domain/markets'

const STATUS: Record<ApplicationStatus, { label: string; tone: Tone; next: string }> = {
  submitted:   { label: 'Waiting on an admin', tone: 'warn',    next: 'An admin checks the details, then issues the login.' },
  approved:    { label: 'Verified',            tone: 'info',    next: 'Ready for credentials. Nothing has been created yet.' },
  provisioned: { label: 'On the platform',     tone: 'good',    next: 'The firm has a login.' },
  rejected:    { label: 'Not proceeding',      tone: 'neutral', next: '' },
}

/**
 * The onboarding queue, and the two admin actions on it.
 *
 * The verification step and the credential step are deliberately separate
 * buttons. "Verified" means an admin has read the form and believes the firm and
 * the number; "Issue login" is what actually creates an account and a password
 * that has to be sent to a human. Collapsing them into one click makes it too
 * easy to create an account nobody is expecting.
 */
export function ApplicationQueue({
  applications,
  team,
  isAdmin,
  error,
}: {
  applications: PartnerApplication[]
  team: StaffUser[]
  isAdmin: boolean
  error?: string | null
}) {
  const router = useRouter()
  const [problem, setProblem] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const [rejecting, setRejecting] = useState<PartnerApplication | null>(null)
  const [creds, setCreds] = useState<IssuedCredentials | null>(null)

  const nameOf = (id: string | null) => team.find((s) => s.user_id === id)?.name ?? null

  const waiting = applications.filter((a) => a.status === 'submitted')
  const verified = applications.filter((a) => a.status === 'approved')
  const done = applications.filter((a) => a.status === 'provisioned' || a.status === 'rejected')

  function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>, after?: () => void) {
    setProblem(null)
    start(async () => {
      const res = await fn()
      if (!res.ok) return setProblem(res.error)
      after?.()
      router.refresh()
    })
  }

  function issue(app: PartnerApplication) {
    setProblem(null)
    start(async () => {
      const res = await provisionFromApplication(app.id)
      if (!res.ok) return setProblem(res.error)
      setCreds(res.data)
      router.refresh()
    })
  }

  function Row({ app }: { app: PartnerApplication }) {
    const s = STATUS[app.status]
    return (
      <li className="px-4 py-3.5">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-ink">{app.firm_name}</p>
              <Badge tone={s.tone}>{s.label}</Badge>
              <Badge>{marketLabel(app.market)}</Badge>
            </div>
            <p className="mt-0.5 text-sm text-ink-soft">
              {app.contact_name} · <span className="tnum">{app.phone}</span> · {app.email}
            </p>
            <p className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-ink-faint">
              <span>{app.firm_type.replace('_', ' ')}</span>
              {app.city ? <><span>·</span><span>{app.city}</span></> : null}
              {app.team_size ? <><span>·</span><span>{app.team_size} people</span></> : null}
              {app.gst ? <><span>·</span><span className="font-mono">{app.gst}</span></> : <><span>·</span><span>no GSTIN</span></>}
              {app.met_on ? <><span>·</span><span>met {date(app.met_on)}</span></> : null}
              <span>·</span>
              <span>filed by {nameOf(app.created_by) ?? 'someone no longer on the team'}</span>
            </p>
            {app.typical_projects ? (
              <p className="mt-1 text-xs text-ink-soft">{app.typical_projects}</p>
            ) : null}
            {app.meeting_notes ? (
              <p className="mt-1.5 rounded-md bg-raised px-2.5 py-1.5 text-xs leading-relaxed text-ink-soft">
                {app.meeting_notes}
              </p>
            ) : null}
            {app.review_note ? (
              <p className="mt-1.5 text-xs text-ink-faint">
                <strong>Admin note:</strong> {app.review_note}
                {app.reviewed_by ? ` — ${nameOf(app.reviewed_by) ?? 'an admin'}` : ''}
              </p>
            ) : null}
            {app.status === 'provisioned' && app.partner_id ? (
              <Link
                href={`/console/partners/${app.partner_id}`}
                className="mt-1 inline-block text-xs font-medium text-brand hover:underline"
              >
                Open the firm →
              </Link>
            ) : null}
            {app.proposed_kam ? (
              <p className="mt-1 text-[11px] text-ink-faint">
                KAM: {nameOf(app.proposed_kam) ?? 'someone no longer on the team'}
              </p>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            {isAdmin && app.status === 'submitted' ? (
              <>
                <Button
                  size="sm"
                  variant="primary"
                  disabled={pending}
                  onClick={() => run(() => reviewApplication(app.id, 'approved'))}
                >
                  <ShieldCheck size={13} /> Verify
                </Button>
                <Button size="sm" disabled={pending} onClick={() => setRejecting(app)}>
                  <X size={13} /> Not proceeding
                </Button>
              </>
            ) : null}
            {isAdmin && app.status === 'approved' ? (
              <>
                <Button size="sm" variant="primary" disabled={pending} onClick={() => issue(app)}>
                  <KeyRound size={13} /> {pending ? 'Creating…' : 'Issue login'}
                </Button>
                <Button size="sm" disabled={pending} onClick={() => setRejecting(app)}>
                  <X size={13} /> Not proceeding
                </Button>
              </>
            ) : null}
            {!isAdmin && (app.status === 'submitted' || app.status === 'approved') ? (
              <span className="self-center text-[11px] text-ink-faint">{s.next}</span>
            ) : null}
          </div>
        </div>
      </li>
    )
  }

  return (
    <>
      {problem ? <div className="mb-4"><Problem title="That did not go through" detail={problem} /></div> : null}
      {error ? <div className="mb-4"><Problem title="The queue did not load" detail={error} /></div> : null}

      <div className="space-y-5">
        <Card>
          <CardHead
            title={`${waiting.length} form${waiting.length === 1 ? '' : 's'} waiting on an admin`}
            hint="Somebody met these firms. Nothing exists for them yet."
            action={
              <Link href="/console/applications/new">
                <Button variant="primary"><Plus size={15} /> Onboard a firm</Button>
              </Link>
            }
          />
          {waiting.length === 0 ? (
            <Empty title="Nothing waiting" body="Every onboarding form has been looked at." />
          ) : (
            <ul className="divide-y divide-line">{waiting.map((a) => <Row key={a.id} app={a} />)}</ul>
          )}
        </Card>

        {verified.length ? (
          <Card>
            <CardHead
              title="Verified — ready for a login"
              hint="An admin has checked these. Issuing shows a password once, for you to send to the firm yourself."
            />
            <ul className="divide-y divide-line">{verified.map((a) => <Row key={a.id} app={a} />)}</ul>
          </Card>
        ) : null}

        {done.length ? (
          <Card>
            <CardHead title="Settled" hint="On the platform, or not proceeding" />
            <ul className="divide-y divide-line">{done.map((a) => <Row key={a.id} app={a} />)}</ul>
          </Card>
        ) : null}
      </div>

      <Modal
        open={rejecting !== null}
        onClose={() => setRejecting(null)}
        title="Not proceeding with this firm"
        hint={rejecting?.firm_name}
      >
        <form
          action={(form) => {
            if (!rejecting) return
            run(
              () => reviewApplication(rejecting.id, 'rejected', String(form.get('note') ?? '')),
              () => setRejecting(null),
            )
          }}
          className="space-y-3"
        >
          <Field
            label="Why"
            required
            hint="Whoever filed it reads this. The form also stops blocking the phone number, so the firm can be re-applied for later."
          >
            <Textarea name="note" rows={3} required />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setRejecting(null)}>Cancel</Button>
            <Button type="submit" variant="danger" disabled={pending}>
              <Check size={14} /> Save
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={creds !== null}
        onClose={() => setCreds(null)}
        title="Login created"
        hint={creds ? `For ${creds.firmName}` : undefined}
      >
        {creds ? <CredentialsIssued creds={creds} onDone={() => setCreds(null)} /> : null}
      </Modal>
    </>
  )
}
