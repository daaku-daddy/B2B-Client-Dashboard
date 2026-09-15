'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CalendarClock, Plus, UserPlus } from 'lucide-react'
import {
  Badge, Button, Card, CardHead, Empty, Field, Input, Problem, Select, Table, Td, Textarea, Th, type Tone,
} from '@/components/ui'
import { Modal } from '@/components/ui/Modal'
import { addTouch, createProspect, updateProspect } from '@/lib/data/console-actions'
import { MARKETS, marketLabel } from '@/lib/domain/markets'
import type { OutreachProspect, OutreachTouch, ProspectStage, StaffUser, TouchKind } from '@/lib/domain/types'
import { date, dateTime, relative } from '@/lib/format'

/**
 * The outreach manager's week.
 *
 * Stages run left to right and a firm that says no lands on `not_interested`
 * rather than being deleted — "we spoke to them in March and they had a supplier
 * tie-up" is the single most useful thing to know before ringing them again, and
 * a deleted row cannot tell anybody that.
 *
 * The end of the pipeline is the onboarding form, not an account: "Onboard them"
 * opens the form pre-filled from the prospect and links the two, so an admin
 * verifying the form can see who worked it.
 */
const STAGES: { key: ProspectStage; label: string; tone: Tone }[] = [
  { key: 'to_contact',     label: 'To contact',     tone: 'neutral' },
  { key: 'contacted',      label: 'Contacted',      tone: 'info' },
  { key: 'meeting_set',    label: 'Meeting set',    tone: 'brand' },
  { key: 'met',            label: 'Met',            tone: 'brand' },
  { key: 'onboarding',     label: 'Onboarding',     tone: 'warn' },
  { key: 'onboarded',      label: 'On the platform', tone: 'good' },
  { key: 'not_interested', label: 'Not now',        tone: 'neutral' },
]

const TOUCH_KINDS: TouchKind[] = ['call', 'whatsapp', 'email', 'meeting', 'visit', 'note']

export function ProspectBoard({
  prospects,
  touches,
  team,
  defaultMarket,
  error,
  touchesError,
}: {
  prospects: OutreachProspect[]
  touches: OutreachTouch[]
  team: StaffUser[]
  defaultMarket: string | null
  error?: string | null
  touchesError?: string | null
}) {
  const router = useRouter()
  const [openId, setOpenId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [filter, setFilter] = useState<ProspectStage | 'all'>('all')
  const [problem, setProblem] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const nameOf = (id: string | null) => team.find((s) => s.user_id === id)?.name ?? null
  const open = prospects.find((p) => p.id === openId) ?? null

  const counts = useMemo(() => {
    const m = new Map<ProspectStage, number>()
    for (const p of prospects) m.set(p.stage, (m.get(p.stage) ?? 0) + 1)
    return m
  }, [prospects])

  const due = prospects.filter(
    (p) =>
      p.next_action_on &&
      p.stage !== 'not_interested' &&
      p.stage !== 'onboarded' &&
      new Date(p.next_action_on) <= new Date(),
  )

  const shown = filter === 'all' ? prospects : prospects.filter((p) => p.stage === filter)

  function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>, after?: () => void) {
    setProblem(null)
    start(async () => {
      const res = await fn()
      if (!res.ok) return setProblem(res.error)
      after?.()
      router.refresh()
    })
  }

  if (open) {
    const log = touches.filter((t) => t.prospect_id === open.id)
    const stage = STAGES.find((s) => s.key === open.stage)
    return (
      <>
        <button
          onClick={() => setOpenId(null)}
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft transition hover:text-brand"
        >
          <ArrowLeft size={14} /> Back to the list
        </button>
        {problem ? <div className="mb-4"><Problem title="That did not save" detail={problem} /></div> : null}

        <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
          <Card>
            <CardHead
              title={open.firm_name}
              hint={[open.contact_name, open.phone, open.email].filter(Boolean).join(' · ') || 'No contact details yet'}
              action={<Badge tone={stage?.tone ?? 'neutral'}>{stage?.label ?? open.stage}</Badge>}
            />
            <div className="grid gap-3 px-4 py-3.5 sm:grid-cols-3">
              <Field label="Stage">
                <Select
                  value={open.stage}
                  disabled={pending}
                  onChange={(e) => run(() => updateProspect(open.id, { stage: e.target.value as ProspectStage }))}
                >
                  {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </Select>
              </Field>
              <Field label="Next action on">
                <Input
                  type="date"
                  defaultValue={open.next_action_on ?? ''}
                  disabled={pending}
                  onBlur={(e) => {
                    const v = e.target.value || null
                    if (v !== (open.next_action_on ?? null)) run(() => updateProspect(open.id, { next_action_on: v }))
                  }}
                />
              </Field>
              <Field label="Worked by">
                <Select
                  value={open.owner_id ?? ''}
                  disabled={pending}
                  onChange={(e) => run(() => updateProspect(open.id, { owner_id: e.target.value || null }))}
                >
                  <option value="">Nobody yet</option>
                  {team
                    .filter((s) => s.active && (s.role === 'outreach' || s.role === 'inbound' || s.role === 'admin'))
                    .map((s) => <option key={s.user_id} value={s.user_id}>{s.name}</option>)}
                </Select>
              </Field>
            </div>
            <div className="border-t border-line px-4 py-3">
              <Field label="Notes">
                <Textarea
                  rows={3}
                  defaultValue={open.notes ?? ''}
                  disabled={pending}
                  onBlur={(e) => {
                    if (e.target.value !== (open.notes ?? '')) run(() => updateProspect(open.id, { notes: e.target.value }))
                  }}
                />
              </Field>
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3">
              {open.application_id ? (
                <Link href="/console/applications" className="text-sm font-medium text-brand hover:underline">
                  An onboarding form has been filed for them →
                </Link>
              ) : (
                <Link href={`/console/applications/new?prospect=${open.id}`}>
                  <Button variant="primary"><UserPlus size={14} /> Onboard them</Button>
                </Link>
              )}
              <span className="text-[11px] text-ink-faint">
                {marketLabel(open.market)}
                {open.city ? ` · ${open.city}` : ''}
                {open.source ? ` · came from ${open.source}` : ''}
              </span>
            </div>
          </Card>

          <Card>
            <CardHead title="Every call and meeting" hint="Newest first" />
            <form
              action={(form) =>
                run(
                  () =>
                    addTouch({
                      prospectId: open.id,
                      kind: String(form.get('kind') ?? 'note') as TouchKind,
                      outcome: String(form.get('outcome') ?? ''),
                      note: String(form.get('note') ?? ''),
                    }),
                  () => router.refresh(),
                )
              }
              className="space-y-2.5 border-b border-line px-4 py-3"
            >
              <div className="grid grid-cols-2 gap-2.5">
                <Field label="What">
                  <Select name="kind" defaultValue="call">
                    {TOUCH_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                  </Select>
                </Field>
                <Field label="Outcome">
                  <Input name="outcome" placeholder="reached / no answer / met" />
                </Field>
              </div>
              <Field label="What happened">
                <Textarea name="note" rows={2} />
              </Field>
              <Button type="submit" size="sm" disabled={pending} className="w-full">
                {pending ? 'Saving…' : 'Log it'}
              </Button>
            </form>
            {touchesError ? (
              <div className="p-4"><Problem title="The log did not load" detail={touchesError} /></div>
            ) : log.length === 0 ? (
              <Empty title="Nothing logged yet" body="Every call, message and meeting goes here." />
            ) : (
              <ul className="divide-y divide-line">
                {log.map((t) => (
                  <li key={t.id} className="px-4 py-2.5">
                    <p className="text-sm text-ink">
                      <span className="font-medium capitalize">{t.kind}</span>
                      {t.outcome ? <span className="text-ink-soft"> — {t.outcome}</span> : null}
                    </p>
                    {t.note ? <p className="text-xs text-ink-soft">{t.note}</p> : null}
                    <p className="tnum mt-0.5 text-[11px] text-ink-faint">
                      {dateTime(t.occurred_at)}
                      {t.by_user ? ` · ${nameOf(t.by_user) ?? 'someone no longer on the team'}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </>
    )
  }

  return (
    <>
      {problem ? <div className="mb-4"><Problem title="That did not save" detail={problem} /></div> : null}
      {error ? <div className="mb-4"><Problem title="The list did not load" detail={error} /></div> : null}

      {due.length ? (
        <Card className="mb-5 border-warn-soft bg-warn-soft">
          <div className="px-4 py-3">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-warn">
              <CalendarClock size={14} /> {due.length} {due.length === 1 ? 'firm is' : 'firms are'} due a follow-up
            </p>
            <p className="mt-1 text-xs text-ink-soft">
              {due.slice(0, 6).map((p) => p.firm_name).join(' · ')}
              {due.length > 6 ? ` and ${due.length - 6} more` : ''}
            </p>
          </div>
        </Card>
      ) : null}

      <Card>
        <CardHead
          title={`${prospects.length} firm${prospects.length === 1 ? '' : 's'} on the list`}
          hint="Everyone we are talking to who is not on the platform yet"
          action={<Button variant="primary" onClick={() => setAdding(true)}><Plus size={15} /> Add a firm</Button>}
        />

        <div className="flex flex-wrap gap-1.5 border-b border-line px-4 py-2.5">
          <button
            onClick={() => setFilter('all')}
            className={`rounded-md px-2 py-1 text-xs font-medium transition ${
              filter === 'all' ? 'bg-brand-soft text-brand' : 'text-ink-faint hover:bg-raised hover:text-ink'
            }`}
          >
            All {prospects.length}
          </button>
          {STAGES.map((s) => (
            <button
              key={s.key}
              onClick={() => setFilter(s.key)}
              className={`rounded-md px-2 py-1 text-xs font-medium transition ${
                filter === s.key ? 'bg-brand-soft text-brand' : 'text-ink-faint hover:bg-raised hover:text-ink'
              }`}
            >
              {s.label} {counts.get(s.key) ?? 0}
            </button>
          ))}
        </div>

        {prospects.length === 0 ? (
          <Empty
            title="Nobody on your list yet"
            body="Add the architects and interior designers you are reaching out to. Every call and meeting goes on the firm's own record, and the onboarding form is filled in from it."
            action={<Button variant="primary" onClick={() => setAdding(true)}><Plus size={15} /> Add your first</Button>}
          />
        ) : shown.length === 0 ? (
          <Empty title="Nothing at that stage" body="Try another one." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Firm</Th><Th>Contact</Th><Th>Market</Th><Th>Stage</Th>
                <Th>Next action</Th><Th>Worked by</Th><Th>Updated</Th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => {
                const s = STAGES.find((x) => x.key === p.stage)
                const overdue =
                  p.next_action_on && p.stage !== 'not_interested' && p.stage !== 'onboarded' &&
                  new Date(p.next_action_on) <= new Date()
                return (
                  <tr key={p.id} onClick={() => setOpenId(p.id)} className="cursor-pointer transition hover:bg-raised">
                    <Td className="font-medium">{p.firm_name}</Td>
                    <Td className="text-xs text-ink-soft">
                      {p.contact_name ?? '—'}
                      {p.phone ? <span className="tnum"> · {p.phone}</span> : null}
                    </Td>
                    <Td className="text-xs text-ink-soft">{marketLabel(p.market)}</Td>
                    <Td><Badge tone={s?.tone ?? 'neutral'}>{s?.label ?? p.stage}</Badge></Td>
                    <Td className={`text-xs ${overdue ? 'font-semibold text-warn' : 'text-ink-soft'}`}>
                      {p.next_action_on ? date(p.next_action_on) : '—'}
                    </Td>
                    <Td className="text-xs text-ink-soft">{nameOf(p.owner_id) ?? '—'}</Td>
                    <Td className="text-xs text-ink-faint">{relative(p.updated_at)}</Td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
        )}
      </Card>

      <Modal open={adding} onClose={() => setAdding(false)} title="Add a firm to your list" hint="Somebody you are going to reach out to.">
        <form
          action={(form) =>
            run(
              () =>
                createProspect({
                  firm_name: String(form.get('firm_name') ?? ''),
                  contact_name: String(form.get('contact_name') ?? ''),
                  phone: String(form.get('phone') ?? ''),
                  email: String(form.get('email') ?? ''),
                  city: String(form.get('city') ?? ''),
                  market: String(form.get('market') ?? ''),
                  firm_type: String(form.get('firm_type') ?? ''),
                  source: String(form.get('source') ?? ''),
                  next_action_on: String(form.get('next_action_on') ?? '') || null,
                  notes: String(form.get('notes') ?? ''),
                }),
              () => setAdding(false),
            )
          }
          className="space-y-3"
        >
          <Field label="Firm / studio name" required>
            <Input name="firm_name" required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Contact">
              <Input name="contact_name" />
            </Field>
            <Field label="Mobile" hint="Ten digits, or leave it blank.">
              <Input name="phone" inputMode="numeric" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Email">
              <Input type="email" name="email" />
            </Field>
            <Field label="City">
              <Input name="city" />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Market" required>
              <Select name="market" defaultValue={defaultMarket ?? ''} required>
                <option value="">Pick one</option>
                {MARKETS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
              </Select>
            </Field>
            <Field label="They are">
              <Select name="firm_type" defaultValue="architect">
                <option value="architect">Architect</option>
                <option value="interior_designer">Interior designer</option>
                <option value="design_build">Design &amp; build</option>
                <option value="contractor">Contractor</option>
                <option value="other">Other</option>
              </Select>
            </Field>
            <Field label="Found via">
              <Input name="source" placeholder="instagram" />
            </Field>
          </div>
          <Field label="Next action on">
            <Input type="date" name="next_action_on" />
          </Field>
          <Field label="Anything worth knowing">
            <Textarea name="notes" rows={2} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={pending}>{pending ? 'Adding…' : 'Add'}</Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
