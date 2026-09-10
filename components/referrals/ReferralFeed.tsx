import { Building2, FileText, Eye, Phone, ShoppingCart, Store } from 'lucide-react'
import type { ReferralEvent, ReferralEventType } from '@/lib/domain/types'
import { Empty, Problem } from '@/components/ui'
import { dateTime, inr } from '@/lib/format'

const ICON: Record<ReferralEventType, typeof Store> = {
  store_visit: Store,
  product_view: Eye,
  cart_add: ShoppingCart,
  quote_shared: FileText,
  order_placed: Building2,
  call: Phone,
  other: Building2,
}

const TITLE: Record<ReferralEventType, string> = {
  store_visit: 'Visited a store',
  product_view: 'Looked at a product',
  cart_add: 'Added to cart',
  quote_shared: 'Was sent a quote',
  order_placed: 'Placed an order',
  call: 'Spoke to us',
  other: 'Activity',
}

/**
 * The referral timeline. One row per event, newest first.
 *
 * Events are deduplicated at ingest on `external_id`, which matters here more
 * than it looks: Material Depot's field apps log one real store arrival several
 * times, and "visited 20 times on the 9th" is a number an architect would read
 * and believe.
 */
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
  if (error) return <div className="p-4"><Problem title="This did not load" detail={error} /></div>
  if (!events.length) {
    return <Empty title="Nothing yet" body={emptyBody ?? 'Activity will appear here.'} />
  }

  return (
    <ul className="divide-y divide-line">
      {events.map((e) => {
        const Icon = ICON[e.event_type] ?? Building2
        return (
          <li key={e.id} className="flex gap-3 px-4 py-3">
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
              <Icon size={14} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-ink">
                <span className="font-medium">{names.get(e.referral_id) ?? 'Your client'}</span>{' '}
                <span className="text-ink-soft">{(TITLE[e.event_type] ?? 'Activity').toLowerCase()}</span>
                {e.store ? <span className="text-ink-soft"> at {e.store}</span> : null}
              </p>
              {e.title ? <p className="truncate text-xs text-ink-soft">{e.title}</p> : null}
              {e.detail ? <p className="text-xs text-ink-faint">{e.detail}</p> : null}
              <p className="tnum mt-0.5 text-[11px] text-ink-faint">
                {dateTime(e.occurred_at)}
                {e.amount ? ` · ${inr(e.amount)}` : ''}
              </p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
