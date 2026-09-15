import { ShoppingCart } from 'lucide-react'
import type { CartState } from '@/lib/domain/referrals'
import { Badge, Empty } from '@/components/ui'
import { dateTime, inr, num, relative } from '@/lib/format'

/**
 * What is sitting in a referred client's Material Depot cart right now.
 *
 * This is the single most actionable thing on an architect's screen — a client
 * with ₹78,400 of oak and laminate in a cart and no order is a phone call, and
 * it was previously findable only by reading a `cart_add` line in a merged
 * stream of everybody's events.
 *
 * Whether the cart is still open is DERIVED (`cartState()` in
 * `lib/domain/referrals.ts`) because the sync sends events, not cart state. So
 * the panel says what it is actually looking at — the last cart we saw, and
 * whether an order followed it — rather than asserting "active" as a fact
 * Material Depot told us.
 */
export function CartPanel({ cart, emptyBody }: { cart: CartState; emptyBody?: string }) {
  if (cart.state === 'none') {
    return (
      <Empty
        icon={<ShoppingCart size={20} />}
        title="Nothing in a cart"
        body={emptyBody ?? 'When they put something in a cart at a store, it shows up here with its value.'}
      />
    )
  }

  const { cart: c } = cart
  const ordered = cart.state === 'ordered'

  return (
    <div className="px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex items-center gap-2">
          <Badge tone={ordered ? 'good' : 'brand'}>{ordered ? 'Ordered' : 'Still open'}</Badge>
          <span className="text-sm font-medium text-ink">
            {c.itemCount !== null ? `${c.itemCount} item${c.itemCount === 1 ? '' : 's'}` : 'Cart'}
            {c.store ? <span className="font-normal text-ink-soft"> · {c.store}</span> : null}
          </span>
        </div>
        <span className="tnum font-display text-lg font-semibold text-ink">
          {c.value !== null ? inr(c.value) : '—'}
        </span>
      </div>

      {c.lines.length ? (
        <ul className="mt-2.5 divide-y divide-line rounded-lg border border-line">
          {c.lines.map((l, i) => (
            <li key={i} className="flex items-baseline justify-between gap-3 px-2.5 py-1.5 text-xs">
              <span className="min-w-0 text-ink">
                {l.label}
                {l.sku ? <span className="text-ink-faint"> · {l.sku}</span> : null}
              </span>
              <span className="tnum shrink-0 whitespace-nowrap text-ink-soft">
                {l.qty !== null ? `${num(l.qty)}${l.unit ? ` ${l.unit}` : ''}` : ''}
                {l.rate !== null ? ` · ${inr(l.rate)}` : ''}
              </span>
            </li>
          ))}
        </ul>
      ) : c.summary ? (
        <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{c.summary}</p>
      ) : (
        <p className="mt-1.5 text-xs text-ink-faint">
          Material Depot sent us the cart total but not what is in it.
        </p>
      )}

      <p className="mt-2 text-[11px] text-ink-faint">
        {ordered ? (
          <>Last updated {dateTime(c.at)} — an order followed {relative(cart.orderedAt)}.</>
        ) : (
          <>Last updated {dateTime(c.at)} ({relative(c.at)}). Nothing ordered from it yet.</>
        )}
      </p>
    </div>
  )
}
