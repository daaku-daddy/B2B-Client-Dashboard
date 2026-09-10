'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ExternalLink, Trash2, Wand2 } from 'lucide-react'
import { Badge, Input, Td } from '@/components/ui'
import { deleteBoardItem, updateBoardItem } from '@/lib/data/actions'
import { quantityFromArea } from '@/lib/domain/quantity'
import { lineMath } from '@/lib/domain/money'
import { inr } from '@/lib/format'
import type { BoardItem, ProjectArea } from '@/lib/domain/types'

/**
 * One product on a board. Quantity and wastage are edited in place, because
 * getting quantities right is most of the work of turning a mood board into a
 * quote, and a modal per row would make that unbearable.
 */
export function BoardItemRow({
  item, area, path, onError,
}: {
  item: BoardItem
  area: ProjectArea
  path: string
  onError: (msg: string | null) => void
}) {
  const router = useRouter()
  const [qty, setQty] = useState(item.qty?.toString() ?? '')
  const [wastage, setWastage] = useState(item.wastage_pct?.toString() ?? '0')
  const [pending, start] = useTransition()

  const math = lineMath(
    { qty: Number(qty) || 0, rate: item.rate ?? 0, gst_pct: item.gst_pct ?? 0, line_markup_pct: null },
    0,
  )

  // Which measurement this surface is driven by. A floor product takes the
  // floor area; everything else takes the wall area. Never guessed silently —
  // the button says which it used.
  const surface = (item.surface ?? '').toLowerCase()
  const usesFloor = surface.includes('floor') || surface.includes('deck') || surface.includes('tread')
  const basisArea = usesFloor ? area.floor_area_sqft : area.wall_area_sqft
  const auto = quantityFromArea({
    areaSqft: basisArea,
    unit: item.unit,
    coverageArea: item.coverage_area,
    wastagePct: Number(wastage) || 0,
  })

  function save(values: Record<string, unknown>) {
    onError(null)
    start(async () => {
      const res = await updateBoardItem(item.id, path, values)
      if (!res.ok) return onError(res.error)
      router.refresh()
    })
  }

  function remove() {
    onError(null)
    start(async () => {
      const res = await deleteBoardItem(item.id, path)
      if (!res.ok) return onError(res.error)
      router.refresh()
    })
  }

  return (
    <tr className={pending ? 'opacity-60' : undefined}>
      <Td>
        <div className="flex items-center gap-2">
          {item.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.image_url} alt="" className="size-9 shrink-0 rounded object-cover" loading="lazy" />
          ) : (
            <div className="size-9 shrink-0 rounded bg-raised" />
          )}
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-ink">{item.product_name ?? 'Item'}</p>
            <p className="truncate text-[11px] text-ink-faint">
              {[item.brand, item.size, item.sku].filter(Boolean).join(' · ') || '—'}
            </p>
          </div>
        </div>
      </Td>
      <Td><Badge>{item.surface ?? '—'}</Badge></Td>
      <Td>
        <div className="flex items-center gap-1">
          <Input
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            onBlur={() => {
              const n = qty.trim() === '' ? null : Number(qty)
              if (n !== item.qty) save({ qty: Number.isFinite(n as number) ? n : null })
            }}
            inputMode="decimal"
            className="tnum h-7 w-20 text-xs"
          />
          <span className="text-[11px] whitespace-nowrap text-ink-faint">{item.unit ?? '—'}</span>
          {auto.outcome === 'ok' ? (
            <button
              type="button"
              title={`${auto.note} — from the ${usesFloor ? 'floor' : 'wall'} area`}
              onClick={() => { setQty(String(auto.qty)); save({ qty: auto.qty }) }}
              className="rounded p-1 text-ink-faint transition hover:bg-brand-soft hover:text-brand"
            >
              <Wand2 size={12} />
            </button>
          ) : (
            <span
              title={auto.note}
              className={auto.outcome === 'unknown' ? 'cursor-help text-warn' : 'cursor-help text-ink-faint'}
            >
              <Wand2 size={12} className="opacity-40" />
            </span>
          )}
        </div>
        {auto.outcome === 'unknown' ? (
          <p className="mt-0.5 max-w-[16rem] text-[10px] leading-tight text-warn">{auto.note}</p>
        ) : null}
      </Td>
      <Td>
        <Input
          value={wastage}
          onChange={(e) => setWastage(e.target.value)}
          onBlur={() => {
            const n = Number(wastage) || 0
            if (n !== item.wastage_pct) save({ wastage_pct: n })
          }}
          inputMode="decimal"
          className="tnum h-7 w-14 text-xs"
        />
      </Td>
      <Td className="tnum text-right text-xs">
        {item.rate ? inr(item.rate, { paise: true }) : <span className="text-warn">no rate</span>}
      </Td>
      <Td className="tnum text-right text-xs font-semibold">
        {math.mdAmount ? inr(math.mdAmount) : '—'}
      </Td>
      <Td className="text-right">
        <div className="flex items-center justify-end gap-0.5">
          {item.md_url ? (
            <a
              href={item.md_url}
              target="_blank"
              rel="noreferrer"
              className="rounded p-1.5 text-ink-faint transition hover:bg-raised hover:text-brand"
              title="See it on materialdepot.com"
            >
              <ExternalLink size={12} />
            </a>
          ) : null}
          <button
            onClick={remove}
            disabled={pending}
            className="rounded p-1.5 text-ink-faint transition hover:bg-bad-soft hover:text-bad"
            title="Remove from board"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </Td>
    </tr>
  )
}
