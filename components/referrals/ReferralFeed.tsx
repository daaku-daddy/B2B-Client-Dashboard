'use client'

import { useState } from 'react'
import {
  Building2, ChevronDown, Eye, FileText, Phone, ShoppingCart, Store,
} from 'lucide-react'
import type { ReferralEvent, ReferralEventType } from '@/lib/domain/types'
import type { Tone } from '@/components/ui'
import { Badge, Empty, Problem } from '@/components/ui'
import { readCart } from '@/lib/domain/referrals'
import { cn } from '@/lib/cn'
import { dateTime, inr, num } from '@/lib/format'

/**
 * The referral timeline. One tappable row per event, newest first.
 *
 * ## Why the row is a chip and a value, not a sentence
 *
 * This was a paragraph per event — "Kavya Iyer visited a store at Jayanagar /
 * First visit / Browsing only. Brief not finalised. / 05 Sept, 12:15 pm" — four
 * lines each, and twelve of them stacked was a wall of prose nobody scans. The
 * row now carries the KIND as a chip and the one value that kind is about: the
 * store for a visit, the product for a view, the size and value of a cart, the
 * enquiry id for an order. Everything else is one tap away, which is where the
 * prose belongs — it is worth reading once, on the event you care about.
 *
 * ## Events are deduplicated at ingest, not here
 *
 * `external_id` is the dedupe key. It matters more than it looks: Material
 * Depot's field apps log one real store arrival several times — twenty, in one
 * measured case — and "visited 20 times on the 9th" is a number an architect
 * would read and believe.
 */

const KIND: Record<ReferralEventType, { label: string; Icon: typeof Store; tone: Tone }> = {
  store_visit: { label: 'Store visit', Icon: Store, tone: 'neutral' },
  product_view: { label: 'Product', Icon: Eye, tone: 'neutral' },
  cart_add: { label: 'Cart', Icon: ShoppingCart, tone: 'brand' },
  quote_shared: { label: 'Quote', Icon: FileText, tone: 'info' },
  order_placed: { label: 'Order', Icon: Building2, tone: 'good' },
  call: { label: 'Call', Icon: Phone, tone: 'neutral' },
  other: { label: 'Activity', Icon: Building2, tone: 'neutral' },
}

function payloadOf(e: ReferralEvent): Record<string, unknown> {
  return (e.payload ?? {}) as Record<string, unknown>
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null
}

/**
 * The one thing the row shows. Store for a visit, product for a view, size for
 * a cart, enquiry id for an order — the value, not a sentence about it.
 */
function headline(e: ReferralEvent): string {
  const p = payloadOf(e)
  switch (e.event_type) {
    case 'store_visit':
      return e.store ?? e.title ?? 'Store visit'
    case 'product_view':
      return e.title ?? str(p.sku) ?? 'A product'
    case 'cart_add': {
      const cart = readCart(e)
      if (cart.itemCount !== null) return `${cart.itemCount} item${cart.itemCount === 1 ? '' : 's'}`
      return e.title ?? 'Cart'
    }
    case 'order_placed':
      return str(p.enq) ?? str(p.md_enq_id) ?? e.title ?? 'Order placed'
    case 'quote_shared':
      return e.store ? `Quote — ${e.store}` : (e.title ?? 'Quote shared')
    case 'call':
      return e.title ?? 'Call'
    default:
      return e.title ?? 'Activity'
  }
}

/** The small grey second value, when there is a genuinely separate one. */
function aside(e: ReferralEvent): string | null {
  const p = payloadOf(e)
  switch (e.event_type) {
    case 'product_view':
      return str(p.sku) ?? e.store
    case 'cart_add':
    case 'order_placed':
    case 'store_visit':
      return e.event_type === 'store_visit' ? null : e.store
    default:
      return e.store
  }
}

export function ReferralFeed({
  events,
  names,
  error,
  emptyBody,
}: {
  events: ReferralEvent[]
  names: Map<string, string>
  error?: string | null
  emptyBody?: string
}) {
  const [openId, setOpenId] = useState<string | null>(null)

  if (error) return <div className="p-4"><Problem title="This did not load" detail={error} /></div>
  if (!events.length) {
    return <Empty title="Nothing yet" body={emptyBody ?? 'Activity will appear here.'} />
  }

  // The client's name is on the row only when the feed actually spans more than
  // one of them. On a single client's own timeline it is their name repeated
  // down the page, which is exactly the noise this rewrite is removing.
  const multi = new Set(events.map((e) => e.referral_id)).size > 1

  return (
    <ul className="divide-y divide-line">
      {events.map((e) => {
        const kind = KIND[e.event_type] ?? KIND.other
        const { Icon } = kind
        const open = openId === e.id
        const extra = aside(e)
        return (
          <li key={e.id}>
            <button
              type="button"
              onClick={() => setOpenId(open ? null : e.id)}
              aria-expanded={open}
              className={cn(
                'flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition hover:bg-raised',
                open && 'bg-raised',
              )}
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
                <Icon size={13} />
              </span>

              <Badge tone={kind.tone} className="shrink-0">{kind.label}</Badge>

              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">
                  {multi ? (
                    <span className="text-ink-soft">{names.get(e.referral_id) ?? 'Your client'} · </span>
                  ) : null}
                  {headline(e)}
                </span>
                {extra ? <span className="block truncate text-[11px] text-ink-faint">{extra}</span> : null}
              </span>

              <span className="shrink-0 text-right">
                {e.amount ? (
                  <span className="tnum block text-xs font-semibold text-ink">{inr(e.amount)}</span>
                ) : null}
                <span className="tnum block text-[11px] text-ink-faint">{dateTime(e.occurred_at)}</span>
              </span>

              <ChevronDown
                size={14}
                className={cn('shrink-0 text-ink-faint transition-transform', open && 'rotate-180')}
              />
            </button>

            {open ? <Detail event={e} name={names.get(e.referral_id) ?? null} multi={multi} /> : null}
          </li>
        )
      })}
    </ul>
  )
}

/** Everything the row left out, for the one event somebody tapped. */
function Detail({ event, name, multi }: { event: ReferralEvent; name: string | null; multi: boolean }) {
  const p = payloadOf(event)
  const cart = event.event_type === 'cart_add' ? readCart(event) : null

  // payload is free-form and belongs to whoever pushed it. Rather than pick out
  // the keys we happen to know, everything scalar in there is shown — a field
  // the CRM starts sending appears here without a change on this side.
  const rest = Object.entries(p).filter(
    ([k, v]) => k !== 'items' && (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'),
  )

  return (
    <div className="border-t border-line bg-raised px-3 py-3 pl-[46px]">
      {multi && name ? <p className="mb-1 text-xs font-medium text-ink">{name}</p> : null}

      {event.title ? <p className="text-sm font-medium text-ink">{event.title}</p> : null}
      {event.detail ? <p className="mt-0.5 text-sm leading-relaxed text-ink-soft">{event.detail}</p> : null}

      {cart?.lines.length ? (
        <ul className="mt-2 space-y-1">
          {cart.lines.map((l, i) => (
            <li key={i} className="flex items-baseline justify-between gap-3 text-xs">
              <span className="min-w-0 text-ink">
                {l.label}
                {l.sku ? <span className="text-ink-faint"> · {l.sku}</span> : null}
              </span>
              <span className="tnum shrink-0 text-ink-soft">
                {l.qty !== null ? `${num(l.qty)}${l.unit ? ` ${l.unit}` : ''}` : ''}
                {l.rate !== null ? ` · ${inr(l.rate)}` : ''}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[11px]">
        <Pair label="When" value={dateTime(event.occurred_at)} />
        {event.store ? <Pair label="Store" value={event.store} /> : null}
        {event.amount ? <Pair label="Value" value={inr(event.amount)} /> : null}
        {rest.map(([k, v]) => (
          <Pair key={k} label={k.replace(/_/g, ' ')} value={String(v)} />
        ))}
      </dl>
    </div>
  )
}

function Pair({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-ink-faint capitalize">{label}</dt>
      <dd className="tnum font-medium text-ink-soft">{value}</dd>
    </div>
  )
}
