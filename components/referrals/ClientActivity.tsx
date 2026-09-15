'use client'

import { useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, ChevronRight, UserRound } from 'lucide-react'
import type { Referral, ReferralEvent, ReferralOrder } from '@/lib/domain/types'
import { summariseClients, type ClientSummary } from '@/lib/domain/referrals'
import { Badge, Card, CardHead, Empty, Problem } from '@/components/ui'
import { ReferralFeed } from './ReferralFeed'
import { CartPanel } from './CartPanel'
import { date, inr, inrShort, relative } from '@/lib/format'

/**
 * The partner's referred clients, and one client's own timeline behind each name.
 *
 * ## Why this replaced the merged feed
 *
 * The home page used to open with every event from every referred client in one
 * stream — a visit from one client, a product view from another, an order from a
 * third, newest first. It is the shape a log file has, not the shape the
 * question has. An architect wants to know how each of the people they sent us
 * is doing, so the list is one row per client, and the log is what they get when
 * they tap a name.
 *
 * ## The cart is the reason this screen exists
 *
 * A client with things in a cart and no order is the one row worth acting on, so
 * it is a chip on the list and the first panel inside. Whether that cart is
 * still open is derived — see `cartState()` — and the panel says so rather than
 * claiming Material Depot told us.
 *
 * ## Plain props only
 *
 * Every prop here is serialisable, `linkBase` included. It is a string rather
 * than the `(referral) => href` this obviously wants to be because this is a
 * Client Component rendered from Server Components, and a function prop across
 * that boundary throws on first render while type-checking and building
 * perfectly — `docs/landmines.md`, 2026-09-15.
 */
export function ClientActivity({
  referrals,
  events,
  orders,
  eventsError,
  ordersError,
  title = 'Your referred clients',
  hint = 'Tap a name for everything they did with us',
  action,
  linkBase,
  emptyBody,
  emptyAction,
}: {
  referrals: Referral[]
  events: ReferralEvent[]
  orders: ReferralOrder[]
  eventsError?: string | null
  ordersError?: string | null
  title?: string
  hint?: string
  action?: ReactNode
  /** e.g. `/referrals?client=` — the id is appended. A string, deliberately. */
  linkBase?: string
  emptyBody?: string
  emptyAction?: ReactNode
}) {
  const [openId, setOpenId] = useState<string | null>(null)
  const rows = useMemo(() => summariseClients(referrals, events, orders), [referrals, events, orders])
  const open = rows.find((r) => r.referral.id === openId) ?? null

  if (open) return <ClientDetail row={open} onBack={() => setOpenId(null)} error={eventsError} linkBase={linkBase} />

  return (
    <Card>
      <CardHead title={title} hint={hint} action={action} />

      {eventsError || ordersError ? (
        <div className="px-4 pt-3">
          <Problem
            title="Some of this is missing"
            detail={[eventsError, ordersError].filter(Boolean).join(' · ')}
          />
        </div>
      ) : null}

      {rows.length === 0 ? (
        <Empty
          icon={<UserRound size={22} />}
          title="No referred clients yet"
          body={
            emptyBody ??
            'Tell us about a client and everything they do with us — store visits, carts, orders — shows up against their name here.'
          }
          action={emptyAction}
        />
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((r) => (
            <li key={r.referral.id}>
              <button
                type="button"
                onClick={() => setOpenId(r.referral.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-raised"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft font-display text-xs font-semibold text-brand">
                  {initials(r.referral.client_name)}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">{r.referral.client_name}</span>
                  <span className="block truncate text-[11px] text-ink-faint">
                    {r.lastSeen
                      ? `${r.stores[0] ? `${r.stores[0]} · ` : ''}${relative(r.lastSeen)}`
                      : `referred ${date(r.referral.referred_on)} · nothing yet`}
                  </span>
                </span>

                <span className="flex shrink-0 items-center gap-1.5">
                  {r.cart.state === 'open' ? (
                    <Badge tone="brand">
                      Cart {r.cart.cart.value !== null ? inrShort(r.cart.cart.value) : ''}
                    </Badge>
                  ) : null}
                  {r.pendingCount ? <Badge tone="warn">{inrShort(r.pending)} checking</Badge> : null}
                  {r.approved ? (
                    <span className="tnum text-sm font-semibold text-good">{inrShort(r.approved)}</span>
                  ) : null}
                </span>

                <ChevronRight size={15} className="shrink-0 text-ink-faint" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function ClientDetail({
  row, onBack, error, linkBase,
}: {
  row: ClientSummary
  onBack: () => void
  error?: string | null
  linkBase?: string
}) {
  const r = row.referral
  return (
    <div className="space-y-4">
      <Card>
        <CardHead
          title={
            <span className="flex items-center gap-2">
              <button
                type="button"
                onClick={onBack}
                className="-ml-1 rounded-md p-1 text-ink-faint transition hover:bg-raised hover:text-brand"
                title="Back to all clients"
                aria-label="Back to all clients"
              >
                <ArrowLeft size={15} />
              </button>
              {r.client_name}
            </span>
          }
          hint={`${r.md_phone} · referred ${date(r.referred_on)}`}
          action={
            linkBase ? (
              <Link
                href={`${linkBase}${r.id}`}
                className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
              >
                Full record <ArrowRight size={12} />
              </Link>
            ) : null
          }
        />

        <div className="grid grid-cols-3 divide-x divide-line border-b border-line">
          <Figure label="Counted" value={row.approved ? inr(row.approved) : '—'} tone="good" />
          <Figure
            label="Being checked"
            value={row.pendingCount ? inr(row.pending) : '—'}
            hint={row.pendingCount ? `${row.pendingCount} order${row.pendingCount === 1 ? '' : 's'}` : undefined}
          />
          <Figure
            label="Orders"
            value={String(row.orders.length)}
            hint={row.lastSeen ? `last seen ${relative(row.lastSeen)}` : undefined}
          />
        </div>

        <CartPanel
          cart={row.cart}
          emptyBody="Nothing of theirs is sitting in a Material Depot cart right now."
        />
      </Card>

      <Card>
        <CardHead title="What they did" hint="Tap any of it for the detail" />
        <ReferralFeed
          events={row.events}
          names={new Map([[r.id, r.client_name]])}
          error={error}
          emptyBody="Nothing has come through for them yet. Store visits, the products they looked at, their cart and any order will appear here."
        />
      </Card>
    </div>
  )
}

function Figure({
  label, value, hint, tone,
}: {
  label: string
  value: string
  hint?: string
  tone?: 'good'
}) {
  return (
    <div className="px-3 py-2.5">
      <p className="text-[10px] font-medium tracking-wide text-ink-faint uppercase">{label}</p>
      <p className={`tnum font-display text-sm font-semibold ${tone === 'good' ? 'text-good' : 'text-ink'}`}>
        {value}
      </p>
      {hint ? <p className="truncate text-[10px] text-ink-faint">{hint}</p> : null}
    </div>
  )
}

/** `Nikhil & Priya Rao` → `NR`. Two letters, never three. */
function initials(name: string): string {
  const parts = name.replace(/[^\p{L}\s]/gu, ' ').split(/\s+/).filter(Boolean)
  if (!parts.length) return '·'
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}
