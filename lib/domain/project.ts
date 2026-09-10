import type { FinanceEntry, ProcurementItem, Project, ProjectArea, Board } from './types'
import { round2 } from './money'

/** The three stages from the brief, in order, with what each one is for. */
export const STAGES = [
  { key: 'design', label: 'Design', blurb: 'Inspiration boards, room by room' },
  { key: 'procurement', label: 'Procurement', blurb: 'Quote accepted, material being bought' },
  { key: 'execution', label: 'Execution', blurb: 'On site — delivered and installed' },
  { key: 'closed', label: 'Closed', blurb: 'Handed over' },
] as const

export function stageIndex(stage: Project['stage']) {
  return STAGES.findIndex((s) => s.key === stage)
}

/**
 * How far through the design stage a project is: the share of its non-dropped
 * areas that have an approved board. Reported as `null` — not 0% — when there
 * are no areas yet, because "no rooms added" and "no rooms approved" are
 * different facts and a 0% bar reads as the second.
 */
export function designProgress(areas: ProjectArea[], boards: Board[]) {
  const live = areas.filter((a) => a.status !== 'dropped')
  if (!live.length) return null
  const approvedAreas = new Set(
    boards.filter((b) => b.status === 'approved').map((b) => b.area_id),
  )
  const done = live.filter((a) => approvedAreas.has(a.id) || a.status === 'finalised').length
  return { done, total: live.length, pct: Math.round((done / live.length) * 100) }
}

export type ProcurementSummary = {
  items: number
  ordered: number
  delivered: number
  installed: number
  pending: number
  /** value of everything on the list, at Material Depot rates */
  value: number
  valueOrdered: number
  valueDelivered: number
  pctOrdered: number
  pctDelivered: number
}

/**
 * Procurement progress is measured in QUANTITY, not in row counts — half the
 * tiles for one room arriving is not "one of six items done". Row counts are
 * reported too, because that is what a list looks like on screen.
 */
export function procurementSummary(items: ProcurementItem[]): ProcurementSummary {
  let required = 0, ordered = 0, delivered = 0, installed = 0
  let value = 0, valueOrdered = 0, valueDelivered = 0
  for (const i of items) {
    if (i.status === 'cancelled') continue
    required += i.qty_required
    ordered += Math.min(i.qty_ordered, i.qty_required || i.qty_ordered)
    delivered += Math.min(i.qty_delivered, i.qty_required || i.qty_delivered)
    installed += Math.min(i.qty_installed, i.qty_required || i.qty_installed)
    value += i.qty_required * i.rate
    valueOrdered += i.qty_ordered * i.rate
    valueDelivered += i.qty_delivered * i.rate
  }
  const live = items.filter((i) => i.status !== 'cancelled')
  return {
    items: live.length,
    ordered: live.filter((i) => i.qty_ordered > 0).length,
    delivered: live.filter((i) => i.qty_delivered >= i.qty_required && i.qty_required > 0).length,
    installed: live.filter((i) => i.qty_installed >= i.qty_required && i.qty_required > 0).length,
    pending: live.filter((i) => i.qty_ordered <= 0).length,
    value: round2(value),
    valueOrdered: round2(valueOrdered),
    valueDelivered: round2(valueDelivered),
    pctOrdered: required > 0 ? Math.round((ordered / required) * 100) : 0,
    pctDelivered: required > 0 ? Math.round((delivered / required) * 100) : 0,
  }
}

export type ProjectPnl = {
  income: number
  cost: number
  profit: number
  marginPct: number
  incomeSettled: number
  costSettled: number
  /** money invoiced but not yet received */
  receivable: number
  /** money owed out */
  payable: number
}

export function projectPnl(entries: FinanceEntry[]): ProjectPnl {
  let income = 0, cost = 0, incomeSettled = 0, costSettled = 0
  for (const e of entries) {
    if (e.direction === 'income') {
      income += e.amount
      if (e.settled) incomeSettled += e.amount
    } else {
      cost += e.amount
      if (e.settled) costSettled += e.amount
    }
  }
  const profit = round2(income - cost)
  return {
    income: round2(income),
    cost: round2(cost),
    profit,
    marginPct: income > 0 ? round2((profit / income) * 100) : 0,
    incomeSettled: round2(incomeSettled),
    costSettled: round2(costSettled),
    receivable: round2(income - incomeSettled),
    payable: round2(cost - costSettled),
  }
}

export const FINANCE_CATEGORIES = {
  cost: ['Material', 'Labour', 'Transport', 'Site expenses', 'Contractor', 'Vendor advance', 'Other'],
  income: ['Design fee', 'Supervision fee', 'Client advance', 'Client milestone', 'Commission', 'Other'],
} as const
