'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Download, FileText, Hammer, Send, Trash2 } from 'lucide-react'
import type { WorkspaceProps } from '@/components/projects/ProjectWorkspace'
import { Badge, Button, Card, CardHead, Empty, Field, Input, Problem, Table, Td, Th } from '@/components/ui'
import { Modal } from '@/components/ui/Modal'
import { lineMath, quoteTotals } from '@/lib/domain/money'
import { acceptQuote, buildQuoteFromApprovedBoards, deleteQuoteLine, updateQuote, updateQuoteLine } from '@/lib/data/actions'
import { quotePdf } from '@/lib/quote/pdf'
import { date, inr, num, pct } from '@/lib/format'
import { cn } from '@/lib/cn'

/**
 * The quote. Built from whatever boards the client signed off, then edited.
 *
 * Two numbers are shown side by side throughout and they are not the same
 * number: what Material Depot charges, and what the client is quoted. The gap
 * is the architect's margin, which is theirs and never appears on the client
 * PDF.
 */
export function QuoteTab(props: WorkspaceProps) {
  const { project, firm, clientName, areas, boards, quotes, linesByQuote } = props
  const router = useRouter()
  const [activeId, setActiveId] = useState<string | null>(quotes[0]?.id ?? null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [building, setBuilding] = useState(false)
  const [pending, start] = useTransition()

  const quote = quotes.find((q) => q.id === activeId) ?? quotes[0] ?? null
  const lines = quote ? (linesByQuote[quote.id] ?? []) : []
  const totals = quote ? quoteTotals(lines, quote) : null

  const approvedBoards = boards.filter((b) => b.status === 'approved')
  const roomsWithoutApproval = areas.filter(
    (a) => a.status !== 'dropped' && !approvedBoards.some((b) => b.area_id === a.id),
  )

  function build(markupPct: number) {
    setError(null)
    setNotice(null)
    start(async () => {
      const res = await buildQuoteFromApprovedBoards(project.id, markupPct)
      if (!res.ok) return setError(res.error)
      setBuilding(false)
      setActiveId(res.data.quote_id)
      if (res.data.skipped.length) {
        setNotice(
          `Quote v${res.data.version} built with ${res.data.lines} lines. ${res.data.skipped.length} item(s) were left out: ${res.data.skipped.join('; ')}`,
        )
      }
      router.refresh()
    })
  }

  function patchQuote(values: Record<string, unknown>) {
    if (!quote) return
    setError(null)
    start(async () => {
      const res = await updateQuote(quote.id, project.id, values)
      if (!res.ok) return setError(res.error)
      router.refresh()
    })
  }

  function accept() {
    if (!quote) return
    setError(null)
    setNotice(null)
    start(async () => {
      const res = await acceptQuote(quote.id, project.id)
      if (!res.ok) return setError(res.error)
      setNotice(
        `Accepted. ${res.data.seeded} line(s) added to the procurement list${res.data.alreadyThere ? `, ${res.data.alreadyThere} were already there` : ''}. The project has moved to Procurement.`,
      )
      router.refresh()
    })
  }

  function download() {
    if (!quote) return
    quotePdf({
      quote,
      lines,
      projectName: project.name,
      clientName,
      firmName: firm.name,
      firmContact: firm.contact,
      firmPhone: firm.phone,
      firmCity: firm.city,
      firmGst: firm.gst,
    })
  }

  if (!quotes.length) {
    return (
      <>
        {error ? <div className="mb-4"><Problem title="Could not build the quote" detail={error} /></div> : null}
        <Card>
          <CardHead title="Quote" hint="Built from the design options your client signed off" />
          <Empty
            icon={<FileText size={22} />}
            title={approvedBoards.length ? 'Ready to build' : 'Sign off a design option first'}
            body={
              approvedBoards.length
                ? `${approvedBoards.length} room${approvedBoards.length === 1 ? '' : 's'} signed off. Building the quote copies every product, quantity and price off those boards — nothing is re-priced afterwards.`
                : 'Go to Design, mark the option your client picked in each room as “Client picked this”, and the quote builds itself from those products.'
            }
            action={
              approvedBoards.length ? (
                <Button variant="primary" onClick={() => setBuilding(true)}><Hammer size={15} /> Build the quote</Button>
              ) : null
            }
          />
        </Card>
        <BuildDialog open={building} onClose={() => setBuilding(false)} onBuild={build} pending={pending} />
      </>
    )
  }

  return (
    <>
      {error ? <div className="mb-4"><Problem title="Something went wrong" detail={error} /></div> : null}
      {notice ? (
        <div className="mb-4 rounded-[var(--radius-card)] border border-info-soft bg-info-soft px-4 py-3 text-xs leading-relaxed text-ink-soft">
          {notice}
        </div>
      ) : null}

      <Card>
        <CardHead
          title={quote ? `${quote.title ?? `Quote v${quote.version}`}` : 'Quote'}
          hint={
            quote ? (
              <span className="flex flex-wrap items-center gap-x-3">
                <Badge tone={quote.status === 'accepted' ? 'good' : quote.status === 'shared' ? 'warn' : 'neutral'}>
                  {quote.status}
                </Badge>
                <span>{lines.length} lines</span>
                <span>made {date(quote.created_at)}</span>
                {roomsWithoutApproval.length ? (
                  <span className="text-warn">
                    {roomsWithoutApproval.length} room(s) not signed off and therefore not in this quote
                  </span>
                ) : null}
              </span>
            ) : null
          }
          action={
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setBuilding(true)} disabled={pending}>
                <Hammer size={13} /> Rebuild
              </Button>
              <Button size="sm" onClick={download} disabled={!lines.length}>
                <Download size={13} /> PDF
              </Button>
              {quote?.status === 'draft' ? (
                <Button size="sm" onClick={() => patchQuote({ status: 'shared', shared_at: new Date().toISOString() })} disabled={pending}>
                  <Send size={13} /> Mark shared
                </Button>
              ) : null}
              {quote && quote.status !== 'accepted' ? (
                <Button size="sm" variant="primary" onClick={accept} disabled={pending || !lines.length}>
                  <CheckCircle2 size={13} /> Client accepted
                </Button>
              ) : null}
            </div>
          }
        />

        {quotes.length > 1 ? (
          <div className="flex gap-1 overflow-x-auto border-b border-line px-4 py-2">
            {quotes.map((q) => (
              <button
                key={q.id}
                onClick={() => setActiveId(q.id)}
                className={cn(
                  'rounded-lg px-2.5 py-1 text-xs font-medium whitespace-nowrap transition',
                  quote?.id === q.id ? 'bg-brand-soft text-brand' : 'text-ink-faint hover:bg-raised hover:text-ink',
                )}
              >
                v{q.version} <span className="opacity-60">{q.status}</span>
              </button>
            ))}
          </div>
        ) : null}

        {/* An accepted quote is a record of what the client agreed to, so it is
            read-only — the LINES were already locked, and leaving the markup
            and discount editable beside them meant the total could still be
            changed after the fact. Rebuild for a new version instead. */}
        {quote ? (
          quote.status === 'accepted' ? (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-b border-line bg-raised px-4 py-3 text-xs">
              <span className="text-ink-soft">Markup <strong className="tnum text-ink">{pct(quote.markup_pct)}</strong></span>
              <span className="text-ink-soft">Discount <strong className="tnum text-ink">{inr(quote.discount)}</strong></span>
              <span className="text-ink-soft">Valid until <strong className="text-ink">{date(quote.valid_until)}</strong></span>
              <span className="text-ink-faint">Accepted quotes cannot be edited — rebuild to make a new version.</span>
            </div>
          ) : (
            <div className="grid gap-3 border-b border-line bg-raised px-4 py-3 sm:grid-cols-3">
              <Field label="Your markup %" hint="Applied on top of Material Depot's rate, on every line without its own">
                <Input
                  defaultValue={quote.markup_pct}
                  inputMode="decimal"
                  onBlur={(e) => {
                    const n = Number(e.target.value) || 0
                    if (n !== quote.markup_pct) patchQuote({ markup_pct: n })
                  }}
                  className="tnum"
                />
              </Field>
              <Field label="Discount ₹" hint="Off the client total">
                <Input
                  defaultValue={quote.discount}
                  inputMode="decimal"
                  onBlur={(e) => {
                    const n = Number(e.target.value) || 0
                    if (n !== quote.discount) patchQuote({ discount: n })
                  }}
                  className="tnum"
                />
              </Field>
              <Field label="Valid until">
                <Input
                  type="date"
                  defaultValue={quote.valid_until ?? ''}
                  onBlur={(e) => {
                    if (e.target.value !== (quote.valid_until ?? '')) patchQuote({ valid_until: e.target.value || null })
                  }}
                />
              </Field>
            </div>
          )
        ) : null}

        {!lines.length ? (
          <Empty title="This quote has no lines" body="Rebuild it, or add products to the signed-off boards first." />
        ) : (
          <Table className="min-w-[880px]">
            <thead>
              <tr>
                <Th>Room</Th>
                <Th>Item</Th>
                <Th className="text-right">Qty</Th>
                <Th className="text-right">MD rate</Th>
                <Th className="text-right">MD amount</Th>
                <Th className="text-right">Markup</Th>
                <Th className="text-right">Client pays</Th>
                <Th className="text-right">Your margin</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <LineRow key={l.id} line={l} quote={quote!} projectId={project.id} onError={setError} />
              ))}
            </tbody>
            {totals ? (
              <tfoot>
                <tr className="bg-raised font-semibold">
                  <Td colSpan={4} className="text-right text-xs tracking-wide text-ink-faint uppercase">Totals</Td>
                  <Td className="tnum text-right">{inr(totals.mdAmount)}</Td>
                  <Td />
                  <Td className="tnum text-right text-brand">{inr(totals.clientTotal)}</Td>
                  <Td className={cn('tnum text-right', totals.margin < 0 ? 'text-bad' : 'text-good')}>
                    {inr(totals.margin)}
                  </Td>
                  <Td />
                </tr>
              </tfoot>
            ) : null}
          </Table>
        )}
      </Card>

      {totals ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Summary label="Material Depot bill" value={inr(totals.mdAmount)} hint={`GST inside: ${inr(totals.tax)}`} />
          <Summary label="Client subtotal" value={inr(totals.clientSubtotal)} hint={`at ${pct(quote!.markup_pct)} markup`} />
          <Summary
            label="Client pays"
            value={inr(totals.clientTotal)}
            hint={totals.discount ? `after ${inr(totals.discount)} discount` : 'no discount'}
            tone="brand"
          />
          <Summary
            label="Your margin"
            value={inr(totals.margin)}
            hint={`${pct(totals.marginPct)} of the total`}
            tone={totals.margin < 0 ? 'bad' : 'good'}
          />
        </div>
      ) : null}

      <BuildDialog open={building} onClose={() => setBuilding(false)} onBuild={build} pending={pending} defaultMarkup={quote?.markup_pct} />
    </>
  )
}

function Summary({
  label, value, hint, tone,
}: {
  label: string
  value: string
  hint?: string
  tone?: 'brand' | 'good' | 'bad'
}) {
  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface p-3.5">
      <p className="text-[11px] font-medium tracking-wide text-ink-faint uppercase">{label}</p>
      <p
        className={cn(
          'tnum mt-1 font-display text-xl font-semibold',
          tone === 'brand' && 'text-brand',
          tone === 'good' && 'text-good',
          tone === 'bad' && 'text-bad',
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-[11px] text-ink-faint">{hint}</p> : null}
    </div>
  )
}

function LineRow({
  line, quote, projectId, onError,
}: {
  line: WorkspaceProps['linesByQuote'][string][number]
  quote: NonNullable<WorkspaceProps['quotes'][number]>
  projectId: string
  onError: (m: string | null) => void
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const m = lineMath(line, quote.markup_pct)
  const locked = quote.status === 'accepted'

  function save(values: Record<string, unknown>) {
    onError(null)
    start(async () => {
      const res = await updateQuoteLine(line.id, projectId, values)
      if (!res.ok) return onError(res.error)
      router.refresh()
    })
  }

  function remove() {
    onError(null)
    start(async () => {
      const res = await deleteQuoteLine(line.id, projectId)
      if (!res.ok) return onError(res.error)
      router.refresh()
    })
  }

  return (
    <tr className={pending ? 'opacity-60' : undefined}>
      <Td className="text-xs text-ink-soft">{line.area_label ?? '—'}</Td>
      <Td className="max-w-[18rem]">
        <p className="truncate text-xs text-ink">{line.description}</p>
        {line.sku ? <p className="text-[10px] text-ink-faint">{line.sku}</p> : null}
      </Td>
      <Td className="text-right">
        {locked ? (
          <span className="tnum text-xs">{num(line.qty)} {line.unit}</span>
        ) : (
          <span className="inline-flex items-center gap-1">
            <Input
              defaultValue={line.qty}
              inputMode="decimal"
              onBlur={(e) => {
                const n = Number(e.target.value) || 0
                if (n !== line.qty) save({ qty: n })
              }}
              className="tnum h-7 w-16 text-right text-xs"
            />
            <span className="text-[10px] text-ink-faint">{line.unit}</span>
          </span>
        )}
      </Td>
      <Td className="tnum text-right text-xs text-ink-soft">{inr(line.rate, { paise: true })}</Td>
      <Td className="tnum text-right text-xs">{inr(m.mdAmount)}</Td>
      <Td className="text-right">
        {locked ? (
          <span className="tnum text-xs text-ink-soft">{pct(m.markupPct)}</span>
        ) : (
          <Input
            defaultValue={line.line_markup_pct ?? ''}
            placeholder={String(quote.markup_pct)}
            inputMode="decimal"
            onBlur={(e) => {
              const raw = e.target.value.trim()
              const n = raw === '' ? null : Number(raw)
              if (n !== line.line_markup_pct) save({ line_markup_pct: Number.isFinite(n as number) ? n : null })
            }}
            className="tnum h-7 w-14 text-right text-xs"
          />
        )}
      </Td>
      <Td className="tnum text-right text-xs font-semibold text-brand">{inr(m.clientAmount)}</Td>
      <Td className={cn('tnum text-right text-xs', m.margin < 0 ? 'text-bad' : 'text-good')}>{inr(m.margin)}</Td>
      <Td className="text-right">
        {locked ? null : (
          <button
            onClick={remove}
            disabled={pending}
            className="rounded p-1.5 text-ink-faint transition hover:bg-bad-soft hover:text-bad"
            title="Remove line"
          >
            <Trash2 size={12} />
          </button>
        )}
      </Td>
    </tr>
  )
}

function BuildDialog({
  open, onClose, onBuild, pending, defaultMarkup,
}: {
  open: boolean
  onClose: () => void
  onBuild: (markup: number) => void
  pending: boolean
  defaultMarkup?: number
}) {
  const [markup, setMarkup] = useState(String(defaultMarkup ?? 15))
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Build the quote"
      hint="Every product on every signed-off board, copied with today's prices."
    >
      <Field
        label="Your markup %"
        hint="Applied on top of Material Depot's rates. You can change it afterwards, and override it line by line."
      >
        <Input value={markup} onChange={(e) => setMarkup(e.target.value)} inputMode="decimal" className="tnum" autoFocus />
      </Field>
      <p className="mt-3 text-xs leading-relaxed text-ink-soft">
        Prices are copied, not linked. If Material Depot's price changes tomorrow, this quote does not — which is what
        lets you send it to a client. Rebuild to pick up new prices.
      </p>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={() => onBuild(Number(markup) || 0)} disabled={pending}>
          {pending ? 'Building…' : 'Build it'}
        </Button>
      </div>
    </Modal>
  )
}
