/**
 * Calendar periods, and the date-range control the Overview runs on — PRD §8.2.1
 * and §10.4.
 *
 * Everything here is pure and works on `YYYY-MM-DD` strings rather than `Date`
 * instants. That is deliberate: `referral_order.ordered_on` is a DATE, the
 * incentive programme runs on Indian calendar months, and the server this runs
 * on is UTC. `new Date('2026-09-01')` is midnight UTC, which is 5:30am on the
 * 1st in Bengaluru — harmless — but `new Date(...).getMonth()` on an order
 * placed at 11pm IST on the 31st returns the NEXT month. A partner's slab must
 * not depend on which timezone the renderer happened to be in, so month and
 * quarter assignment never leaves string space.
 */

export type PeriodKind = 'month' | 'quarter'

/** `2026-09` for a month, `2026-Q3` for a quarter. */
export type PeriodKey = string

export type Period = {
  kind: PeriodKind
  key: PeriodKey
  /** inclusive, `YYYY-MM-DD` */
  from: string
  /** inclusive, `YYYY-MM-DD` */
  to: string
  label: string
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** `YYYY-MM-DD` for today in India, whatever the server's timezone is. */
export function todayIST(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

/** The date part of anything the database hands back — a DATE or a timestamptz. */
export function dayOf(v: string | null | undefined): string | null {
  if (!v) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v)
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null
}

const pad = (n: number) => String(n).padStart(2, '0')
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate()

export function monthKey(day: string): PeriodKey {
  return day.slice(0, 7)
}

export function quarterKey(day: string): PeriodKey {
  const y = day.slice(0, 4)
  const q = Math.floor((Number(day.slice(5, 7)) - 1) / 3) + 1
  return `${y}-Q${q}`
}

export function periodKeyOf(day: string, kind: PeriodKind): PeriodKey {
  return kind === 'month' ? monthKey(day) : quarterKey(day)
}

export function month(key: PeriodKey): Period {
  const y = Number(key.slice(0, 4))
  const m = Number(key.slice(5, 7))
  return {
    kind: 'month',
    key,
    from: `${y}-${pad(m)}-01`,
    to: `${y}-${pad(m)}-${pad(lastDay(y, m))}`,
    label: `${MONTHS[m - 1]} ${y}`,
  }
}

export function quarter(key: PeriodKey): Period {
  const y = Number(key.slice(0, 4))
  const q = Number(key.slice(6, 7))
  const first = (q - 1) * 3 + 1
  const last = first + 2
  return {
    kind: 'quarter',
    key,
    from: `${y}-${pad(first)}-01`,
    to: `${y}-${pad(last)}-${pad(lastDay(y, last))}`,
    label: `${MONTHS[first - 1]}–${MONTHS[last - 1]} ${y}`,
  }
}

export function period(key: PeriodKey, kind: PeriodKind): Period {
  return kind === 'month' ? month(key) : quarter(key)
}

/** The month or quarter a day falls in. */
export function periodOf(day: string, kind: PeriodKind): Period {
  return period(periodKeyOf(day, kind), kind)
}

export function shiftMonth(key: PeriodKey, by: number): PeriodKey {
  const y = Number(key.slice(0, 4))
  const m = Number(key.slice(5, 7)) + by
  const ny = y + Math.floor((m - 1) / 12)
  const nm = ((((m - 1) % 12) + 12) % 12) + 1
  return `${ny}-${pad(nm)}`
}

export function shiftQuarter(key: PeriodKey, by: number): PeriodKey {
  const y = Number(key.slice(0, 4))
  const q = Number(key.slice(6, 7)) + by
  const ny = y + Math.floor((q - 1) / 4)
  const nq = ((((q - 1) % 4) + 4) % 4) + 1
  return `${ny}-Q${nq}`
}

export function shift(key: PeriodKey, kind: PeriodKind, by: number): PeriodKey {
  return kind === 'month' ? shiftMonth(key, by) : shiftQuarter(key, by)
}

/** The trailing N months ending with `key`, oldest first — the coin wall strip
 *  in §10.5.3 and the 12-month revenue trend in §8.2.3. */
export function trailingMonths(key: PeriodKey, count = 12): Period[] {
  return Array.from({ length: count }, (_, i) => month(shiftMonth(key, i - (count - 1))))
}

/** Days remaining in the period, inclusive of today. §10.5.1 shows this
 *  prominently, so a period that has already closed reports 0, never negative. */
export function daysLeftIn(p: Period, today: string = todayIST()): number {
  if (today > p.to) return 0
  const start = today < p.from ? p.from : today
  return Math.max(0, diffDays(start, p.to) + 1)
}

/** Whole days between two `YYYY-MM-DD` strings. Both are treated as UTC noon so
 *  a DST-free but leap-second-adjacent arithmetic cannot round to 0.9 of a day. */
export function diffDays(from: string, to: string): number {
  return Math.round((utc(to) - utc(from)) / 86_400_000)
}

export function addDays(day: string, n: number): string {
  const d = new Date(utc(day) + n * 86_400_000)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

function utc(day: string): number {
  return Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)), 12)
}

// ------------------------------------------------------- the range control

/**
 * §8.2.1: "Default: current month, because the incentive programme runs on
 * calendar months." The presets are the PRD's list, in its order.
 *
 * The selected range is rendered in every card header rather than only in the
 * picker — §8.2.2 asks for that, and it is what stops a partner reading a
 * month's revenue as a lifetime total.
 */
export type RangeKey = 'this_month' | 'last_month' | 'this_quarter' | 'last_3_months' | 'this_fy' | 'custom'

export type Range = { key: RangeKey; from: string; to: string; label: string }

export const RANGE_PRESETS: { key: Exclude<RangeKey, 'custom'>; label: string }[] = [
  { key: 'this_month', label: 'This month' },
  { key: 'last_month', label: 'Last month' },
  { key: 'this_quarter', label: 'This quarter' },
  { key: 'last_3_months', label: 'Last 3 months' },
  { key: 'this_fy', label: 'This FY' },
]

export function resolveRange(key: RangeKey, today: string = todayIST(), custom?: { from?: string; to?: string }): Range {
  const m = month(monthKey(today))
  switch (key) {
    case 'last_month': {
      const p = month(shiftMonth(m.key, -1))
      return { key, from: p.from, to: p.to, label: p.label }
    }
    case 'this_quarter': {
      const p = quarter(quarterKey(today))
      return { key, from: p.from, to: p.to, label: p.label }
    }
    case 'last_3_months': {
      const start = month(shiftMonth(m.key, -2))
      return { key, from: start.from, to: m.to, label: `${start.label} – ${m.label}` }
    }
    case 'this_fy': {
      // India's financial year: 1 April to 31 March.
      const y = Number(today.slice(0, 4))
      const startYear = Number(today.slice(5, 7)) >= 4 ? y : y - 1
      return {
        key,
        from: `${startYear}-04-01`,
        to: `${startYear + 1}-03-31`,
        label: `FY ${String(startYear).slice(2)}–${String(startYear + 1).slice(2)}`,
      }
    }
    case 'custom': {
      const from = custom?.from ?? m.from
      const to = custom?.to ?? m.to
      return { key, from, to, label: `${from} to ${to}` }
    }
    default:
      return { key: 'this_month', from: m.from, to: m.to, label: m.label }
  }
}

/**
 * The equivalent window immediately before this one, for the "vs previous
 * period" delta every metric card carries (§8.2.2). Calendar periods step back
 * a whole month or quarter; an arbitrary range steps back its own length, so
 * the comparison is like-for-like rather than against a stub.
 */
export function previousRange(r: Range): Range {
  if (r.key === 'this_month' || r.key === 'last_month') {
    const p = month(shiftMonth(monthKey(r.from), -1))
    return { key: r.key, from: p.from, to: p.to, label: p.label }
  }
  if (r.key === 'this_quarter') {
    const p = quarter(shiftQuarter(quarterKey(r.from), -1))
    return { key: r.key, from: p.from, to: p.to, label: p.label }
  }
  const span = diffDays(r.from, r.to) + 1
  const to = addDays(r.from, -1)
  const from = addDays(to, -(span - 1))
  return { key: r.key, from, to, label: `${from} to ${to}` }
}

export function within(day: string | null | undefined, r: { from: string; to: string }): boolean {
  if (!day) return false
  return day >= r.from && day <= r.to
}
