'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ExternalLink, Loader2, Search } from 'lucide-react'
import { Button, Empty, Field, Input, Problem, Select } from '@/components/ui'
import { Modal } from '@/components/ui/Modal'
import { searchCatalog, type CatalogResult } from '@/lib/catalog/search'
import type { CatalogPick } from '@/lib/catalog/types'
import { addManualItemToBoard, addProductToBoard } from '@/lib/data/actions'
import { inr } from '@/lib/format'
import { cn } from '@/lib/cn'

const CATEGORIES = ['Tiles', 'Laminates', 'Wallpaper', 'Louvers', 'Veneer', 'Sanitaryware', 'Lights', 'Paint']

/**
 * Pick a product off the Material Depot catalogue and put it on a board.
 *
 * The catalogue lives behind `/api/catalog/search`, which may be unreachable
 * (see that route). When it is, this says so and offers manual entry rather
 * than showing an empty result list — an architect must never be left thinking
 * a product does not exist when the truth is that the search never ran.
 */
export function ProductPicker({
  boardId,
  surfaces,
  path,
  open,
  onClose,
}: {
  boardId: string
  surfaces: string[]
  path: string
  open: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('')
  const [result, setResult] = useState<CatalogResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [manual, setManual] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const abort = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!open) return
    // Debounced so typing does not fire a request per keystroke.
    const t = setTimeout(() => {
      abort.current?.abort()
      const ctl = new AbortController()
      abort.current = ctl
      setLoading(true)
      searchCatalog({ query: q, category: category || undefined, pageSize: 24 }, ctl.signal)
        .then((r) => { if (!ctl.signal.aborted) setResult(r) })
        .finally(() => { if (!ctl.signal.aborted) setLoading(false) })
    }, 300)
    return () => clearTimeout(t)
  }, [q, category, open])

  function add(pick: CatalogPick, surface: string) {
    setError(null)
    start(async () => {
      const res = await addProductToBoard({ board_id: boardId, pick, surface, path })
      if (!res.ok) return setError(res.error)
      onClose()
      router.refresh()
    })
  }

  function addManual(form: FormData) {
    setError(null)
    start(async () => {
      const res = await addManualItemToBoard({
        board_id: boardId,
        product_name: String(form.get('product_name') ?? ''),
        brand: String(form.get('brand') ?? ''),
        unit: String(form.get('unit') ?? ''),
        rate: Number(form.get('rate') ?? 0),
        gst_pct: Number(form.get('gst_pct') ?? 18),
        surface: String(form.get('surface') ?? ''),
        note: String(form.get('note') ?? ''),
        path,
      })
      if (!res.ok) return setError(res.error)
      onClose()
      router.refresh()
    })
  }

  const unavailable = result?.state === 'unavailable' ? result.reason : null

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={manual ? 'Add an item by hand' : 'Add a product'}
      hint={
        manual
          ? 'For anything not in the Material Depot catalogue — a vendor’s item, labour, a custom piece.'
          : 'Prices are Material Depot’s, inclusive of GST, and are saved as they are today.'
      }
    >
      {error ? <div className="mb-3"><Problem title="Could not add it" detail={error} /></div> : null}

      {manual ? (
        <form action={addManual} className="space-y-3">
          <Field label="What is it" required><Input name="product_name" autoFocus placeholder="Teak veneer, 4mm" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Brand / vendor"><Input name="brand" /></Field>
            <Field label="Surface">
              <Select name="surface" defaultValue={surfaces[0] ?? ''}>
                {surfaces.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Unit" required hint="what the rate is per"><Input name="unit" placeholder="sqft" /></Field>
            <Field label="Rate" required hint="₹, incl. GST"><Input name="rate" inputMode="decimal" /></Field>
            <Field label="GST %"><Input name="gst_pct" inputMode="decimal" defaultValue="18" /></Field>
          </div>
          <Field label="Note"><Input name="note" /></Field>
          <div className="flex justify-between pt-1">
            <Button type="button" variant="ghost" onClick={() => setManual(false)}>← Search the catalogue</Button>
            <Button type="submit" variant="primary" disabled={pending}>{pending ? 'Adding…' : 'Add to board'}</Button>
          </div>
        </form>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-[14rem] flex-1">
              <Search size={14} className="absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-faint" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Marble tile, oak laminate, terrazzo…"
                className="pl-8"
                autoFocus
              />
            </div>
            <Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-40">
              <option value="">All categories</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>

          <div className="mt-4 max-h-[52vh] min-h-[16rem] overflow-y-auto">
            {loading && !result ? (
              <div className="flex h-40 items-center justify-center text-ink-faint">
                <Loader2 size={18} className="animate-spin" />
              </div>
            ) : unavailable ? (
              <div className="space-y-3">
                <Problem title="The Material Depot catalogue is not reachable from here" detail={unavailable} />
                <p className="text-sm text-ink-soft">
                  You can still add the item by hand and the quote will be complete — the product just will not carry
                  a catalogue link.
                </p>
                <Button variant="primary" onClick={() => setManual(true)}>Add it by hand instead</Button>
              </div>
            ) : result?.state === 'empty' ? (
              <Empty
                title="Nothing matched"
                body={q ? `No catalogue product matches "${q}".` : 'Type what you are looking for.'}
                action={<Button onClick={() => setManual(true)}>Add it by hand</Button>}
              />
            ) : result?.state === 'ok' ? (
              <>
                <p className="mb-2 text-xs text-ink-faint">
                  {result.total.toLocaleString('en-IN')} products match — showing {result.products.length}
                </p>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {result.products.map((p) => (
                    <ProductRow key={p.variant_id} p={p} surfaces={surfaces} onAdd={add} busy={pending} />
                  ))}
                </ul>
              </>
            ) : null}
          </div>

          <div className="mt-3 flex justify-between border-t border-line pt-3">
            <Button variant="ghost" onClick={() => setManual(true)}>Not in the catalogue? Add by hand</Button>
            <Button variant="ghost" onClick={onClose}>Done</Button>
          </div>
        </>
      )}
    </Modal>
  )
}

function ProductRow({
  p, surfaces, onAdd, busy,
}: {
  p: CatalogPick
  surfaces: string[]
  onAdd: (p: CatalogPick, surface: string) => void
  busy: boolean
}) {
  const [surface, setSurface] = useState(surfaces[0] ?? 'Any')
  const priced = useMemo(() => p.rate !== null && p.rate > 0, [p.rate])

  return (
    <li className="flex gap-3 rounded-lg border border-line p-2.5">
      {p.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.image_url} alt="" className="size-16 shrink-0 rounded-md object-cover" loading="lazy" />
      ) : (
        <div className="size-16 shrink-0 rounded-md bg-raised" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-ink">{p.product_name}</p>
        <p className="truncate text-[11px] text-ink-faint">
          {[p.brand, p.size, p.finish].filter(Boolean).join(' · ') || p.sku || '—'}
        </p>
        <p className="tnum mt-0.5 text-xs">
          {priced ? (
            <>
              <span className="font-semibold text-ink">{inr(p.rate!, { paise: true })}</span>
              <span className="text-ink-faint"> / {p.unit ?? 'unit'}</span>
              {p.gst_pct ? <span className="text-ink-faint"> · incl. {p.gst_pct}% GST</span> : null}
            </>
          ) : (
            // A product with no price is shown, not hidden — but it is labelled,
            // because it cannot be quoted until a rate is typed in.
            <span className="text-warn">No price on this row</span>
          )}
        </p>
        <div className="mt-1.5 flex items-center gap-1.5">
          <Select value={surface} onChange={(e) => setSurface(e.target.value)} className="h-7 flex-1 text-xs">
            {surfaces.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
          <Button size="sm" variant="primary" disabled={busy} onClick={() => onAdd(p, surface)}>Add</Button>
          {p.md_url ? (
            <a
              href={p.md_url}
              target="_blank"
              rel="noreferrer"
              className={cn('rounded-md p-1.5 text-ink-faint transition hover:bg-raised hover:text-brand')}
              title="See it on materialdepot.com"
            >
              <ExternalLink size={13} />
            </a>
          ) : null}
        </div>
      </div>
    </li>
  )
}
