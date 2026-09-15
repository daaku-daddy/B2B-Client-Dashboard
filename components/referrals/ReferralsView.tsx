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
import { CartPanel } from './CartPanel'
import { OrderApprovalBadge } from './OrderApproval'
import { summariseClients } from '@/lib/domain/referrals'
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
  referrals, clients, events, orders, eventsError, initialOpenId,
}: {
  referrals: Referral[]
  clients: Client[]
  events: ReferralEvent[]
  orders: ReferralOrder[]
  eventsError?: string | null
  /** `?client=<referral id>`, so the dashboard can link straight to one. */
  initialOpenId?: string | null
}) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [openId, setOpenId] = useState<string | null>(initialOpenId ?? null)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const [fromClient, setFromClient] = useState('')

  const names = useMemo(() => new Map(referrals.map((r) => [r.id, r.client_name])), [referrals])

  // One rollup, shared with the dashboard's client list — a second copy of this
  // arithmetic here is how the two screens start disagreeing about one client.
  // The money inside it is `attributedSale`/`pendingSale`, which is what the
  // rewards ladder is computed from, so a per-client figure cannot drift from
  // the total it adds up to.
  const stats = useMemo(() => {
    const rows = summariseClients(referrals, events, orders)
    return new Map(rows.map((r) => [r.referral.id, r]))
  }, [referrals, events, orders])

  /**
   * Opening a client is addressable: `/referrals?client=<referral id>`, which
   * is what the dashboard links to. `history.replaceState` rather than
   * `router.replace` on purpose — this is the same route with the same data,
   * and a push would re-run the page's four queries to render a panel that is
   * already in memory. Back still leaves the page, which is what a browser
   * Back on a landing-page drill-in should do.
   */
  function openClient(id: string | null) {
    setOpenId(id)
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    if (id) url.searchParams.set('client', id)
    else url.searchParams.delete('client')
    window.history.replaceState(null, '', url.toString())
  }

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
      openClient(null)
      router.refresh()
    })
  }

  if (open) {
    const s = stats.get(open.id)
    const mine = s?.events ?? []
    const myOrders = s?.orders ?? []
    return (
      <>
        <button
          onClick={() => openClient(null)}
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
              <CardHead
                title="In their cart"
                hint="The last cart we saw at a Material Depot store"
              />
              <CartPanel cart={s?.cart ?? { state: 'none' }} />
            </Card>

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
                <span className="tnum text-sm font-semibold text-good">{inr(s?.approved ?? 0)}</span>
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
                <Th className="text-right">In cart</Th>
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
                    onClick={() => openClient(r.id)}
                    className="cursor-pointer transition hover:bg-raised"
                  >
                    <Td className="font-medium">{r.client_name}</Td>
                    <Td className="tnum text-xs text-ink-soft">{r.md_phone}</Td>
                    <Td className="text-xs text-ink-soft">{date(r.referred_on)}</Td>
                    <Td className="text-xs text-ink-soft">{s?.lastSeen ? relative(s.lastSeen) : '—'}</Td>
                    <Td className="tnum text-right text-xs">
                      {s?.cart.state === 'open' ? (
                        <span className="font-semibold text-brand">
                          {s.cart.cart.value !== null ? inrShort(s.cart.cart.value) : 'open'}
                        </span>
                      ) : (
                        <span className="text-ink-faint">—</span>
                      )}
                    </Td>
                    <Td className="tnum text-right text-xs">{s?.orders.length ?? 0}</Td>
                    <Td className="tnum text-right text-xs font-semibold">
                      {s?.approved ? <span className="text-good">{inrShort(s.approved)}</span> : <span className="text-ink-faint">—</span>}
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
