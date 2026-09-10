import { NextResponse } from 'next/server'
import { supabaseService } from '@/lib/supabase/server'
import { phone10 } from '@/lib/format'

/**
 * Ingest what Material Depot's systems know about a partner's referred clients:
 * store visits, products looked at, carts, quotes and orders.
 *
 * Push, not pull. This route takes a payload; it does not go and fetch from
 * Django. That is deliberate — the referral facts live across three systems
 * (Django `/crm/leads/`, Kylas, and the field-ops Supabase), each with its own
 * credentials, and none of them is reachable from a partner's browser. Whoever
 * owns that data pushes it here on a schedule, authenticated with
 * `SYNC_SHARED_SECRET`.
 *
 * Two properties this route must keep:
 *
 * 1. **Idempotent.** `referral_event.external_id` and `referral_order.md_enq_id`
 *    are unique and every write is an upsert on them. Material Depot's field
 *    apps log one real event several times — a single store arrival has been
 *    seen logged twenty times — so "visited 20 times" is a number this route
 *    exists to prevent an architect from ever reading.
 *
 * 2. **Exact phone matching, with three outcomes.** A row either matches one
 *    referral, matches none, or matches more than one. The third is NOT folded
 *    into the second: it is reported as `ambiguous` and skipped, because
 *    attributing an order to the wrong architect pays the wrong person.
 */

type IncomingEvent = {
  phone: string
  external_id: string
  event_type: 'store_visit' | 'product_view' | 'cart_add' | 'quote_shared' | 'order_placed' | 'call' | 'other'
  occurred_at: string
  store?: string | null
  title?: string | null
  detail?: string | null
  amount?: number | null
  payload?: Record<string, unknown>
}

type IncomingOrder = {
  phone: string
  md_enq_id: string
  order_value: number
  ordered_on?: string | null
  store?: string | null
  status?: string | null
}

type SyncBody = { events?: IncomingEvent[]; orders?: IncomingOrder[] }

type Skip = { key: string; reason: 'no_match' | 'ambiguous' | 'bad_phone' | 'bad_row'; detail?: string }

export async function POST(req: Request) {
  const secret = process.env.SYNC_SHARED_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'SYNC_SHARED_SECRET is not set on this deployment' }, { status: 503 })
  }
  if (req.headers.get('x-sync-key') !== secret) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 })
  }

  let body: SyncBody
  try {
    body = (await req.json()) as SyncBody
  } catch {
    return NextResponse.json({ error: 'bad request body' }, { status: 400 })
  }

  const events = body.events ?? []
  const orders = body.orders ?? []
  if (!events.length && !orders.length) {
    return NextResponse.json({ error: 'nothing to sync: send events and/or orders' }, { status: 400 })
  }

  const db = supabaseService()

  // Resolve every phone in one query, then match EXACTLY in memory.
  const phones = new Set<string>()
  const skipped: Skip[] = []
  for (const e of events) {
    const p = phone10(e.phone)
    if (p) phones.add(p)
  }
  for (const o of orders) {
    const p = phone10(o.phone)
    if (p) phones.add(p)
  }

  const { data: referrals, error: refErr } = await db
    .from('referral')
    .select('id, partner_id, md_phone')
    .in('md_phone', [...phones])
  if (refErr) {
    return NextResponse.json({ error: `referral lookup failed: ${refErr.message}` }, { status: 500 })
  }

  // A phone can legitimately appear under two partners — two architects both
  // claiming the same client. That is a human decision, not a heuristic one.
  const byPhone = new Map<string, { id: string; partner_id: string }[]>()
  for (const r of referrals ?? []) {
    const list = byPhone.get(r.md_phone) ?? []
    list.push({ id: r.id, partner_id: r.partner_id })
    byPhone.set(r.md_phone, list)
  }

  function resolve(rawPhone: string, key: string): { id: string; partner_id: string } | null {
    const p = phone10(rawPhone)
    if (!p) {
      skipped.push({ key, reason: 'bad_phone', detail: rawPhone })
      return null
    }
    const hits = byPhone.get(p) ?? []
    if (hits.length === 1) return hits[0]
    if (hits.length === 0) {
      skipped.push({ key, reason: 'no_match', detail: p })
      return null
    }
    skipped.push({
      key,
      reason: 'ambiguous',
      detail: `${p} is referred by ${hits.length} partners — needs a human to decide whose it is`,
    })
    return null
  }

  const eventRows = []
  for (const e of events) {
    if (!e.external_id || !e.event_type || !e.occurred_at) {
      skipped.push({ key: e.external_id || '(no external_id)', reason: 'bad_row', detail: 'external_id, event_type and occurred_at are all required' })
      continue
    }
    const ref = resolve(e.phone, e.external_id)
    if (!ref) continue
    eventRows.push({
      referral_id: ref.id,
      event_type: e.event_type,
      occurred_at: e.occurred_at,
      store: e.store ?? null,
      title: e.title ?? null,
      detail: e.detail ?? null,
      amount: e.amount ?? null,
      payload: e.payload ?? {},
      external_id: e.external_id,
    })
  }

  const orderRows = []
  const touchedPartners = new Set<string>()
  for (const o of orders) {
    if (!o.md_enq_id) {
      skipped.push({ key: '(no md_enq_id)', reason: 'bad_row', detail: 'md_enq_id is required' })
      continue
    }
    const ref = resolve(o.phone, o.md_enq_id)
    if (!ref) continue
    orderRows.push({
      referral_id: ref.id,
      md_enq_id: o.md_enq_id,
      order_value: Number(o.order_value) || 0,
      ordered_on: o.ordered_on ?? null,
      store: o.store ?? null,
      status: o.status ?? null,
      synced_at: new Date().toISOString(),
    })
    touchedPartners.add(ref.partner_id)
  }

  // Upsert, not insert. The unique keys are what make a re-run harmless.
  let eventsWritten = 0
  if (eventRows.length) {
    const { error, count } = await db
      .from('referral_event')
      .upsert(eventRows, { onConflict: 'external_id', count: 'exact' })
    if (error) return NextResponse.json({ error: `event upsert failed: ${error.message}` }, { status: 500 })
    eventsWritten = count ?? eventRows.length
  }

  let ordersWritten = 0
  if (orderRows.length) {
    const { error, count } = await db
      .from('referral_order')
      .upsert(orderRows, { onConflict: 'md_enq_id', count: 'exact' })
    if (error) return NextResponse.json({ error: `order upsert failed: ${error.message}` }, { status: 500 })
    ordersWritten = count ?? orderRows.length
  }

  const unlocked = await recordUnlockedTiers(db, [...touchedPartners])

  return NextResponse.json({
    ok: true,
    events: { received: events.length, written: eventsWritten },
    orders: { received: orders.length, written: ordersWritten },
    tiers_unlocked: unlocked,
    // Always reported, never swallowed. A sync that quietly dropped 40 orders
    // because nobody had referred those phones is the failure this names.
    skipped,
  })
}

/**
 * Whether a tier is unlocked is DERIVED from the orders, everywhere it is
 * displayed. This only records the moment it happened, so the partner can be
 * told "you earned this on the 9th" and so a handover has a row to hang off.
 * It never deletes a claim: a corrected order value that drops a partner back
 * below a threshold does not un-give a gold coin.
 */
async function recordUnlockedTiers(
  db: ReturnType<typeof supabaseService>,
  partnerIds: string[],
) {
  if (!partnerIds.length) return []

  const { data: tiers } = await db.from('reward_tier').select('id, threshold').eq('active', true)
  if (!tiers?.length) return []

  const out: { partner_id: string; tier_id: number }[] = []
  for (const partnerId of partnerIds) {
    const { data: refs } = await db.from('referral').select('id').eq('partner_id', partnerId)
    const ids = (refs ?? []).map((r) => r.id)
    if (!ids.length) continue

    const { data: ords } = await db.from('referral_order').select('order_value').in('referral_id', ids)
    const total = (ords ?? []).reduce((s, o) => s + (Number(o.order_value) || 0), 0)

    const due = tiers.filter((t) => total >= Number(t.threshold))
    if (!due.length) continue

    const { error } = await db.from('reward_claim').upsert(
      due.map((t) => ({ partner_id: partnerId, tier_id: t.id, status: 'unlocked' as const })),
      { onConflict: 'partner_id,tier_id', ignoreDuplicates: true },
    )
    if (!error) due.forEach((t) => out.push({ partner_id: partnerId, tier_id: t.id }))
  }
  return out
}
