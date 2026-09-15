'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Trash2, UserPlus } from 'lucide-react'
import type { Client, Referral, ReferralEvent, ReferralOrder } from '@/lib/domain/types'
import {
  Button, Card, CardHead, Empty, Field, Input, Problem, Select, Table, Td, Textarea, Th,
} from '@/components/ui'
import { Modal } from '@/components/ui/Modal'
import { ReferralFeed } from './ReferralFeed'
import { OrderApprovalBadge } from './OrderApproval'
import { createReferral, deleteReferral } from '@/lib/data/actions'
import { date, inr, inrShort, relative } from '@/lib/format'

/**
 * Referrals: the clients an architect sent to Material Depot, and everything
 * those clients then did with us.
 *
 * Matching is on the exact ten-digit phone number and nothing else. That is why
 * the form refuses a number it cannot parse instead of storing it anyway: a
 * referral with a wrong number is a referral whose orders will never be
 * credited, and it would sit there looking fine.
 */
export function ReferralsView({
  referrals, clients, events, orders, eventsError,
}: {
  referrals: Referral[]
  clients: Client[]
  events: ReferralEvent[]
  orders: ReferralOrder[]
  eventsError?: string | null
}) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const [fromClient, setFromClient] = useState('')

  const names = useMemo(() => new Map(referrals.map((r) => [r.id, r.client_name])), [referrals])

  const stats = useMemo(() => {
    // `value` is APPROVED money only — it is what the rewards ladder is computed
    // from, so a total here that included an unverified order would disagree with
    // the Rewards page by exactly that order. `pending` is carried separately and
    // shown as its own thing.
    const byRef = new Map<string, { orders: number; value: number; pending: number; pendingCount: number; events: number; last: string | null }>()
    for (const r of referrals) byRef.set(r.id, { orders: 0, value: 0, pending: 0, pendingCount: 0, events: 0, last: null })
    for (const o of orders) {
      const row = byRef.get(o.referral_id)
      if (!row) continue
      row.orders += 1
      if (o.approval_status === 'approved') row.value += Number(o.order_value || 0)
      else if (o.approval_status === 'pending') {
        row.pending += Number(o.order_value || 0)
        row.pendingCount += 1
      }
    }
    for (const e of events) {
      const row = byRef.get(e.referral_id)
      if (!row) continue
      row.events += 1
      if (!row.last || e.occurred_at > row.last) row.last = e.occurred_at
    }
    return byRef
  }, [referrals, orders, events])

  const open = referrals.find((r) => r.id === openId) ?? null

  function submit(form: FormData) {
    setError(null)
    start(async () => {
      const picked = clients.find((c) => c.id === fromClient)
      const res = await createReferral({
        client_id: picked?.id ?? null,
        client_name: picked?.name ?? String(form.get('client_name') ?? ''),
        md_phone: picked?.phone ?? String(form.get('md_phone') ?? ''),
        notes: String(form.get('notes') ?? ''),
      })
      if (!res.ok) return setError(res.error)
      setAdding(false)
      setFromClient('')
      router.refresh()
    })
  }

  function remove(id: string) {
    setError(null)
    start(async () => {
      const res = await deleteReferral(id)
      if (!res.ok) return setError(res.error)
      setOpenId(null)
      router.refresh()
    })
  }

  if (open) {
    const s = stats.get(open.id)
    const mine = events.filter((e) => e.referral_id === open.id)
    const myOrders = orders.filter((o) => o.referral_id === open.id)
    return (
      <>
        <button
          onClick={() => setOpenId(null)}
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft transition hover:text-brand"
        >
          <ArrowLeft size={14} /> All referrals
        </button>

        <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <Card>
            <CardHead
              title={open.client_name}
              hint={`${open.md_phone} · referred ${date(open.referred_on)}`}
              action={
                <button
                  onClick={() => remove(open.id)}
                  disabled={pending}
                  className="rounded-md p-1.5 text-ink-faint transition hover:bg-bad-soft hover:text-bad"
                  title="Remove this referral"
                >
                  <Trash2 size={14} />
                </button>
              }
            />
            <ReferralFeed
              events={mine}
              names={names}
              error={eventsError}
              emptyBody="Nothing has come through for them yet. Store visits, the products they looked at, their cart and any order will appear here."
            />
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHead title="What they have bought" hint="Counts towards your rewards" />
              {myOrders.length === 0 ? (
                <Empty title="No orders yet" body="Their orders will show here as they are placed." />
              ) : (
                <Table className="min-w-0">
                  <thead>
                    <tr><Th>Order</Th><Th>Placed</Th><Th /><Th className="text-right">Value</Th></tr>
                  </thead>
                  <tbody>
                    {myOrders.map((o) => (
                      <tr key={o.id}>
                        {/* The enquiry id gets the room its real length needs. A
                            truncated ENQ… is not a shortened number, it is a
                            different one to anyone reading it off the screen. */}
                        <Td className="font-mono text-[11px]" title={o.md_enq_id}>{o.md_enq_id}</Td>
                        <Td className="text-xs text-ink-soft">{date(o.ordered_on)}</Td>
                        <Td><OrderApprovalBadge status={o.approval_status} /></Td>
                        <Td className="tnum text-right text-xs font-medium">{inr(o.order_value)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
              <div className="flex items-center justify-between border-t border-line px-4 py-2.5">
                <span className="text-xs font-medium text-ink-soft">Counting towards your rewards</span>
                <span className="tnum text-sm font-semibold text-good">{inr(s?.value ?? 0)}</span>
              </div>
              {s?.pendingCount ? (
                <p className="border-t border-line px-4 py-2 text-[11px] text-ink-faint">
                  {inr(s.pending)} across {s.pendingCount} order{s.pendingCount === 1 ? '' : 's'} is still
                  being checked by us, and is not in that figure yet.
                </p>
              ) : null}
            </Card>

            {open.notes ? (
              <Card>
                <CardHead title="Your note" />
                <p className="px-4 py-3 text-sm leading-relaxed text-ink-soft">{open.notes}</p>
              </Card>
            ) : null}
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      {error ? <div className="mb-4"><Problem title="Something went wrong" detail={error} /></div> : null}

      <Card>
        <CardHead
          title={`${referrals.length} referred client${referrals.length === 1 ? '' : 's'}`}
          hint="Everything they do with us shows up here — and counts towards your rewards"
          action={<Button variant="primary" onClick={() => setAdding(true)}><UserPlus size={15} /> Refer a client</Button>}
        />

        {referrals.length === 0 ? (
          <Empty
            icon={<UserPlus size={22} />}
            title="No referrals yet"
            body="Send a client to Material Depot and you will see when they visited which store, what they looked at, what is in their cart, and what they ordered. Every rupee of it counts towards your rewards."
            action={<Button variant="primary" onClick={() => setAdding(true)}><Plus size={15} /> Refer your first client</Button>}
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Client</Th>
                <Th>Phone</Th>
                <Th>Referred</Th>
                <Th>Last seen</Th>
                <Th className="text-right">Activity</Th>
                <Th className="text-right">Orders</Th>
                <Th className="text-right">Value</Th>
              </tr>
            </thead>
            <tbody>
              {referrals.map((r) => {
                const s = stats.get(r.id)
                return (
                  <tr
                    key={r.id}
                    onClick={() => setOpenId(r.id)}
                    className="cursor-pointer transition hover:bg-raised"
                  >
                    <Td className="font-medium">{r.client_name}</Td>
                    <Td className="tnum text-xs text-ink-soft">{r.md_phone}</Td>
                    <Td className="text-xs text-ink-soft">{date(r.referred_on)}</Td>
                    <Td className="text-xs text-ink-soft">{s?.last ? relative(s.last) : '—'}</Td>
                    <Td className="tnum text-right text-xs">{s?.events ?? 0}</Td>
                    <Td className="tnum text-right text-xs">{s?.orders ?? 0}</Td>
                    <Td className="tnum text-right text-xs font-semibold">
                      {s?.value ? <span className="text-good">{inrShort(s.value)}</span> : <span className="text-ink-faint">—</span>}
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
        )}
      </Card>

      <Modal
        open={adding}
        onClose={() => { setAdding(false); setFromClient('') }}
        title="Refer a client"
        hint="Their exact mobile number is what links their visits and orders back to you."
      >
        {error ? <div className="mb-3"><Problem title="Could not save" detail={error} /></div> : null}
        <form action={submit} className="space-y-3">
          {clients.length ? (
            <Field label="One of your clients" hint="Or leave this blank and type someone else in below.">
              <Select value={fromClient} onChange={(e) => setFromClient(e.target.value)}>
                <option value="">Someone not on my client list</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id} disabled={!c.phone}>
                    {c.name}{c.phone ? ` — ${c.phone}` : ' — no phone on file'}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}

          {!fromClient ? (
            <>
              <Field label="Client name" required><Input name="client_name" /></Field>
              <Field
                label="Their mobile number"
                required
                hint="10 digits. It has to be the number they will give us in store — we match on it exactly."
              >
                <Input name="md_phone" inputMode="numeric" placeholder="9876543210" />
              </Field>
            </>
          ) : (
            <div className="rounded-lg border border-line bg-raised px-3 py-2 text-xs text-ink-soft">
              Referring <strong className="text-ink">{clients.find((c) => c.id === fromClient)?.name}</strong> on{' '}
              <span className="tnum">{clients.find((c) => c.id === fromClient)?.phone}</span>.
              {!clients.find((c) => c.id === fromClient)?.phone ? (
                <span className="mt-1 block text-bad">
                  This client has no phone number on file. Add one on their client record first — without it nothing
                  can be credited to you.
                </span>
              ) : null}
            </div>
          )}

          <Field label="Note" hint="What they are looking for, which project it is against.">
            <Textarea name="notes" rows={2} />
          </Field>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => { setAdding(false); setFromClient('') }}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={pending}>{pending ? 'Saving…' : 'Refer them'}</Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
