'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Truck } from 'lucide-react'
import type { WorkspaceProps } from '@/components/projects/ProjectWorkspace'
import type { ProcurementItem, ProcurementStatus } from '@/lib/domain/types'
import {
  Badge, Button, Card, CardHead, Empty, Field, Input, Problem, Progress, Select, Stat, Table, Td, Th,
} from '@/components/ui'
import { Modal } from '@/components/ui/Modal'
import { procurementSummary } from '@/lib/domain/project'
import { addProcurementItem, deleteProcurementItem, updateProcurementItem } from '@/lib/data/actions'
import { date, inr, inrShort, num, pct } from '@/lib/format'
import { cn } from '@/lib/cn'

const STATUSES: ProcurementStatus[] = ['pending', 'ordered', 'dispatched', 'delivered', 'installed', 'cancelled']

const STATUS_TONE: Record<ProcurementStatus, 'neutral' | 'info' | 'warn' | 'good' | 'bad'> = {
  pending: 'neutral',
  ordered: 'info',
  dispatched: 'warn',
  delivered: 'good',
  installed: 'good',
  cancelled: 'bad',
}

/**
 * The procurement list: what has to be bought, what has been bought, and what
 * has landed on site.
 *
 * Progress is measured in QUANTITY, not in rows — half the tiles for one room
 * arriving is not "one of six items done" — and both figures are shown, because
 * the row count is what the list looks like and the quantity is what is true.
 */
export function ProcurementTab({ project, procurement, quotes }: WorkspaceProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [pending, start] = useTransition()

  const summary = procurementSummary(procurement)
  const accepted = quotes.find((q) => q.status === 'accepted')

  function add(form: FormData) {
    setError(null)
    start(async () => {
      const res = await addProcurementItem({
        project_id: project.id,
        description: String(form.get('description') ?? ''),
        unit: String(form.get('unit') ?? ''),
        qty_required: Number(form.get('qty_required') ?? 0),
        rate: Number(form.get('rate') ?? 0),
        area_label: String(form.get('area_label') ?? ''),
      })
      if (!res.ok) return setError(res.error)
      setAdding(false)
      router.refresh()
    })
  }

  return (
    <>
      {error ? <div className="mb-4"><Problem title="Something went wrong" detail={error} /></div> : null}

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="On the list"
          value={summary.items}
          hint={`${inrShort(summary.value)} at Material Depot rates`}
        />
        <Stat
          label="Ordered"
          value={pct(summary.pctOrdered)}
          hint={`${summary.ordered} of ${summary.items} lines · ${inrShort(summary.valueOrdered)}`}
          tone="brand"
        />
        <Stat
          label="Delivered"
          value={pct(summary.pctDelivered)}
          hint={`${summary.delivered} lines complete · ${inrShort(summary.valueDelivered)}`}
          tone="good"
        />
        <Stat
          label="Still to order"
          value={summary.pending}
          hint={summary.pending ? 'lines with nothing ordered yet' : 'everything is on order'}
          tone={summary.pending ? 'bad' : 'good'}
        />
      </div>

      <Card>
        <CardHead
          title="Procurement list"
          hint={
            accepted
              ? `Seeded from quote v${accepted.version}. Edit quantities as material actually moves.`
              : 'Accept a quote and this fills itself from its lines. You can also add lines by hand.'
          }
          action={<Button variant="primary" onClick={() => setAdding(true)}><Plus size={15} /> Add a line</Button>}
        />

        {procurement.length === 0 ? (
          <Empty
            icon={<Truck size={22} />}
            title="Nothing to procure yet"
            body="When your client accepts a quote, every line on it lands here with its quantity — then you track what has been ordered, what has shipped and what is on site."
          />
        ) : (
          <Table className="min-w-[900px]">
            <thead>
              <tr>
                <Th>Room</Th>
                <Th>Item</Th>
                <Th className="text-right">Needed</Th>
                <Th className="text-right">Ordered</Th>
                <Th className="text-right">Delivered</Th>
                <Th className="text-right">Installed</Th>
                <Th>Status</Th>
                <Th>MD order</Th>
                <Th className="text-right">Value</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {procurement.map((i) => (
                <Row key={i.id} item={i} projectId={project.id} onError={setError} />
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Modal open={adding} onClose={() => setAdding(false)} title="Add a procurement line" hint="For anything not on the quote.">
        {error ? <div className="mb-3"><Problem title="Could not add it" detail={error} /></div> : null}
        <form action={add} className="space-y-3">
          <Field label="What is it" required><Input name="description" autoFocus /></Field>
          <Field label="Room / area"><Input name="area_label" placeholder="Master Bath" /></Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Quantity" required><Input name="qty_required" inputMode="decimal" /></Field>
            <Field label="Unit" required><Input name="unit" placeholder="sqft" /></Field>
            <Field label="Rate ₹"><Input name="rate" inputMode="decimal" /></Field>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={pending}>{pending ? 'Adding…' : 'Add line'}</Button>
          </div>
        </form>
      </Modal>
    </>
  )
}

function Row({
  item, projectId, onError,
}: {
  item: ProcurementItem
  projectId: string
  onError: (m: string | null) => void
}) {
  const router = useRouter()
  const [pending, start] = useTransition()

  function save(values: Record<string, unknown>) {
    onError(null)
    start(async () => {
      const res = await updateProcurementItem(item.id, projectId, values)
      if (!res.ok) return onError(res.error)
      router.refresh()
    })
  }

  function remove() {
    onError(null)
    start(async () => {
      const res = await deleteProcurementItem(item.id, projectId)
      if (!res.ok) return onError(res.error)
      router.refresh()
    })
  }

  /**
   * Changing a quantity moves the status with it, so the two cannot disagree.
   * The status is still editable by hand — 'cancelled' has no quantity that
   * implies it, and a delivery that is short needs saying out loud.
   */
  function saveQty(field: 'qty_ordered' | 'qty_delivered' | 'qty_installed', raw: string) {
    const n = Number(raw) || 0
    if (n === item[field]) return
    const next = { ...item, [field]: n }
    let status: ProcurementStatus = item.status
    if (item.status !== 'cancelled') {
      if (next.qty_installed > 0) status = 'installed'
      else if (next.qty_delivered > 0) status = 'delivered'
      else if (next.qty_ordered > 0) status = 'ordered'
      else status = 'pending'
    }
    save({ [field]: n, status, ...(field === 'qty_delivered' && n > 0 && !item.delivered_on ? { delivered_on: new Date().toISOString().slice(0, 10) } : {}) })
  }

  const pctDone = item.qty_required > 0 ? (item.qty_delivered / item.qty_required) * 100 : 0

  return (
    <tr className={cn(pending && 'opacity-60', item.status === 'cancelled' && 'opacity-50')}>
      <Td className="text-xs text-ink-soft">{item.area_label ?? '—'}</Td>
      <Td className="max-w-[16rem]">
        <p className="truncate text-xs text-ink">{item.description}</p>
        {item.sku ? <p className="text-[10px] text-ink-faint">{item.sku}</p> : null}
        <Progress pct={pctDone} tone={pctDone >= 100 ? 'good' : 'brand'} className="mt-1 max-w-[10rem]" />
      </Td>
      <Td className="tnum text-right text-xs">{num(item.qty_required)} <span className="text-ink-faint">{item.unit}</span></Td>
      <Td className="text-right">
        <Input
          defaultValue={item.qty_ordered}
          inputMode="decimal"
          onBlur={(e) => saveQty('qty_ordered', e.target.value)}
          className="tnum h-7 w-16 text-right text-xs"
        />
      </Td>
      <Td className="text-right">
        <Input
          defaultValue={item.qty_delivered}
          inputMode="decimal"
          onBlur={(e) => saveQty('qty_delivered', e.target.value)}
          className="tnum h-7 w-16 text-right text-xs"
        />
      </Td>
      <Td className="text-right">
        <Input
          defaultValue={item.qty_installed}
          inputMode="decimal"
          onBlur={(e) => saveQty('qty_installed', e.target.value)}
          className="tnum h-7 w-16 text-right text-xs"
        />
      </Td>
      <Td>
        <Select
          defaultValue={item.status}
          onChange={(e) => save({ status: e.target.value })}
          className="h-7 w-28 text-xs"
        >
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
        {item.delivered_on ? <p className="mt-0.5 text-[10px] text-ink-faint">{date(item.delivered_on)}</p> : null}
      </Td>
      <Td>
        <Input
          defaultValue={item.md_enq_id ?? ''}
          placeholder="ENQ…"
          onBlur={(e) => {
            const v = e.target.value.trim() || null
            if (v !== item.md_enq_id) save({ md_enq_id: v })
          }}
          className="h-7 w-28 font-mono text-[11px]"
        />
      </Td>
      <Td className="tnum text-right text-xs font-medium">{inr(item.qty_required * item.rate)}</Td>
      <Td className="text-right">
        <div className="flex items-center justify-end gap-1">
          <Badge tone={STATUS_TONE[item.status]}>{item.status}</Badge>
          <button
            onClick={remove}
            disabled={pending}
            className="rounded p-1.5 text-ink-faint transition hover:bg-bad-soft hover:text-bad"
            title="Remove line"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </Td>
    </tr>
  )
}
