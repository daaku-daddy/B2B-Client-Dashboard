'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowDownLeft, ArrowUpRight, Banknote, Check, Plus, Trash2 } from 'lucide-react'
import type { WorkspaceProps } from '@/components/projects/ProjectWorkspace'
import type { FinanceEntry } from '@/lib/domain/types'
import {
  Badge, Button, Card, CardHead, Empty, Field, Input, Problem, Progress, Select, Stat, Table, Td, Th,
} from '@/components/ui'
import { Modal } from '@/components/ui/Modal'
import { FINANCE_CATEGORIES, projectPnl } from '@/lib/domain/project'
import { quoteTotals } from '@/lib/domain/money'
import { addFinanceEntry, deleteFinanceEntry, updateFinanceEntry } from '@/lib/data/actions'
import { date, inr, inrShort, pct } from '@/lib/format'
import { cn } from '@/lib/cn'

/**
 * The money on one project, from the architect's side: what is coming in, what
 * is going out, and what is actually left.
 *
 * The ledger is entered by hand rather than derived from the quote, and that is
 * the right way round: what a client was quoted and what they have actually
 * paid are different facts, and a P&L computed off the quote would show a
 * profit on a project that has not been paid for. The quote can be pulled in as
 * a starting pair of entries, explicitly.
 */
export function MoneyTab({ project, finance, quotes, linesByQuote, procurement }: WorkspaceProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState<'cost' | 'income' | null>(null)
  const [pending, start] = useTransition()

  const pnl = projectPnl(finance)

  const accepted = quotes.find((q) => q.status === 'accepted') ?? quotes.find((q) => q.status === 'shared')
  const acceptedTotals = accepted ? quoteTotals(linesByQuote[accepted.id] ?? [], accepted) : null

  // What the project committed to buy, so an architect can see the ledger
  // against the material they have actually ordered.
  const committed = useMemo(
    () => procurement.filter((i) => i.status !== 'cancelled').reduce((s, i) => s + i.qty_ordered * i.rate, 0),
    [procurement],
  )

  const byCategory = useMemo(() => {
    const map = new Map<string, { cost: number; income: number }>()
    for (const e of finance) {
      const row = map.get(e.category) ?? { cost: 0, income: 0 }
      row[e.direction] += e.amount
      map.set(e.category, row)
    }
    return [...map.entries()].sort((a, b) => b[1].cost + b[1].income - (a[1].cost + a[1].income))
  }, [finance])

  function add(form: FormData) {
    if (!adding) return
    setError(null)
    start(async () => {
      const res = await addFinanceEntry({
        project_id: project.id,
        direction: adding,
        category: String(form.get('category') ?? 'Other'),
        description: String(form.get('description') ?? ''),
        amount: Number(form.get('amount') ?? 0),
        entry_date: String(form.get('entry_date') ?? new Date().toISOString().slice(0, 10)),
        settled: form.get('settled') === 'on',
        counterparty: String(form.get('counterparty') ?? ''),
        reference: String(form.get('reference') ?? ''),
      })
      if (!res.ok) return setError(res.error)
      setAdding(null)
      router.refresh()
    })
  }

  return (
    <>
      {error ? <div className="mb-4"><Problem title="Something went wrong" detail={error} /></div> : null}

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Money in" value={inr(pnl.income)} hint={`${inr(pnl.incomeSettled)} received · ${inr(pnl.receivable)} still owed to you`} tone="good" />
        <Stat label="Money out" value={inr(pnl.cost)} hint={`${inr(pnl.costSettled)} paid · ${inr(pnl.payable)} still to pay`} />
        <Stat
          label="Left with you"
          value={inr(pnl.profit)}
          hint={finance.length ? `${pct(pnl.marginPct)} of what came in` : 'No entries yet'}
          tone={pnl.profit < 0 ? 'bad' : 'good'}
        />
        <Stat
          label="Material committed"
          value={committed ? inrShort(committed) : '—'}
          hint={committed ? 'ordered on the procurement list' : 'nothing ordered yet'}
        />
      </div>

      {acceptedTotals && !finance.length ? (
        <Card className="mb-4 border-brand-line bg-brand-soft">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-ink">Start from quote v{accepted!.version}?</p>
              <p className="mt-0.5 text-xs text-ink-soft">
                It puts two entries in: {inr(acceptedTotals.clientTotal)} coming in from the client, and{' '}
                {inr(acceptedTotals.mdAmount)} going out to Material Depot. Both start unpaid — mark them settled as
                the money actually moves.
              </p>
            </div>
            <Button
              variant="primary"
              disabled={pending}
              onClick={() => {
                setError(null)
                start(async () => {
                  const today = new Date().toISOString().slice(0, 10)
                  const income = await addFinanceEntry({
                    project_id: project.id, direction: 'income', category: 'Client milestone',
                    description: `Quote v${accepted!.version} — total quoted to client`,
                    amount: acceptedTotals.clientTotal, entry_date: today,
                  })
                  if (!income.ok) return setError(income.error)
                  const cost = await addFinanceEntry({
                    project_id: project.id, direction: 'cost', category: 'Material',
                    description: `Quote v${accepted!.version} — material from Material Depot`,
                    amount: acceptedTotals.mdAmount, entry_date: today, counterparty: 'Material Depot',
                  })
                  // The income entry already saved. Say what happened rather
                  // than pretending the whole thing failed.
                  if (!cost.ok) return setError(`The client entry was added, but the material cost was not: ${cost.error}`)
                  router.refresh()
                })
              }}
            >
              Add both entries
            </Button>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHead
            title="Ledger"
            hint="Every rupee in and out of this project"
            action={
              <div className="flex gap-2">
                <Button size="sm" onClick={() => setAdding('income')}><ArrowDownLeft size={13} /> Money in</Button>
                <Button size="sm" onClick={() => setAdding('cost')}><ArrowUpRight size={13} /> Money out</Button>
              </div>
            }
          />
          {finance.length === 0 ? (
            <Empty
              icon={<Banknote size={22} />}
              title="No entries yet"
              body="Log what the client pays you and what the project costs you — material, labour, transport. The margin works itself out."
              action={<Button variant="primary" onClick={() => setAdding('income')}><Plus size={15} /> First entry</Button>}
            />
          ) : (
            <Table className="min-w-[720px]">
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>What</Th>
                  <Th>Category</Th>
                  <Th>Who</Th>
                  <Th className="text-right">Amount</Th>
                  <Th>Settled</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {finance.map((e) => (
                  <EntryRow key={e.id} entry={e} projectId={project.id} onError={setError} />
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHead title="Where it goes" hint="By category" />
          {byCategory.length === 0 ? (
            <Empty title="Nothing to break down" body="Add a few entries and this fills in." />
          ) : (
            <ul className="divide-y divide-line">
              {byCategory.map(([cat, v]) => {
                const total = v.cost + v.income
                const share = pnl.cost + pnl.income > 0 ? (total / (pnl.cost + pnl.income)) * 100 : 0
                return (
                  <li key={cat} className="px-4 py-2.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm text-ink">{cat}</span>
                      <span className="tnum text-xs font-medium text-ink">
                        {v.income ? <span className="text-good">+{inrShort(v.income)}</span> : null}
                        {v.income && v.cost ? ' / ' : null}
                        {v.cost ? <span className="text-ink-soft">−{inrShort(v.cost)}</span> : null}
                      </span>
                    </div>
                    <Progress pct={share} tone={v.income > v.cost ? 'good' : 'brand'} className="mt-1.5" />
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>

      <Modal
        open={adding !== null}
        onClose={() => setAdding(null)}
        title={adding === 'income' ? 'Money coming in' : 'Money going out'}
        hint={adding === 'income' ? 'A fee, an advance, a milestone payment.' : 'Material, labour, transport, a vendor advance.'}
      >
        {error ? <div className="mb-3"><Problem title="Could not save" detail={error} /></div> : null}
        <form action={add} className="space-y-3">
          <Field label="What is it" required><Input name="description" autoFocus /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <Select name="category" defaultValue={adding === 'income' ? 'Design fee' : 'Material'}>
                {(adding === 'income' ? FINANCE_CATEGORIES.income : FINANCE_CATEGORIES.cost).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </Field>
            <Field label="Amount ₹" required><Input name="amount" inputMode="decimal" className="tnum" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date"><Input name="entry_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></Field>
            <Field label={adding === 'income' ? 'From' : 'To'}><Input name="counterparty" /></Field>
          </div>
          <Field label="Reference" hint="Invoice number, UTR — anything you would search for later">
            <Input name="reference" />
          </Field>
          <label className="flex items-center gap-2 text-sm text-ink-soft">
            <input type="checkbox" name="settled" className="size-4 accent-[var(--color-brand)]" />
            {adding === 'income' ? 'Already received' : 'Already paid'}
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setAdding(null)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={pending}>{pending ? 'Saving…' : 'Add entry'}</Button>
          </div>
        </form>
      </Modal>
    </>
  )
}

function EntryRow({
  entry, projectId, onError,
}: {
  entry: FinanceEntry
  projectId: string
  onError: (m: string | null) => void
}) {
  const router = useRouter()
  const [pending, start] = useTransition()

  function toggle() {
    onError(null)
    start(async () => {
      const res = await updateFinanceEntry(entry.id, projectId, { settled: !entry.settled })
      if (!res.ok) return onError(res.error)
      router.refresh()
    })
  }

  function remove() {
    onError(null)
    start(async () => {
      const res = await deleteFinanceEntry(entry.id, projectId)
      if (!res.ok) return onError(res.error)
      router.refresh()
    })
  }

  const isIncome = entry.direction === 'income'

  return (
    <tr className={pending ? 'opacity-60' : undefined}>
      <Td className="text-xs whitespace-nowrap text-ink-soft">{date(entry.entry_date)}</Td>
      <Td className="max-w-[16rem]">
        <p className="truncate text-xs text-ink">{entry.description}</p>
        {entry.reference ? <p className="text-[10px] text-ink-faint">{entry.reference}</p> : null}
      </Td>
      <Td><Badge>{entry.category}</Badge></Td>
      <Td className="text-xs text-ink-soft">{entry.counterparty ?? '—'}</Td>
      <Td className={cn('tnum text-right text-xs font-semibold', isIncome ? 'text-good' : 'text-ink')}>
        {isIncome ? '+' : '−'}{inr(entry.amount)}
      </Td>
      <Td>
        <button
          onClick={toggle}
          disabled={pending}
          className={cn(
            'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium transition',
            entry.settled ? 'border-transparent bg-good-soft text-good' : 'border-line text-ink-faint hover:bg-raised',
          )}
        >
          {entry.settled ? <><Check size={11} /> {isIncome ? 'Received' : 'Paid'}</> : 'Pending'}
        </button>
      </Td>
      <Td className="text-right">
        <button
          onClick={remove}
          disabled={pending}
          className="rounded p-1.5 text-ink-faint transition hover:bg-bad-soft hover:text-bad"
          title="Delete entry"
        >
          <Trash2 size={12} />
        </button>
      </Td>
    </tr>
  )
}
