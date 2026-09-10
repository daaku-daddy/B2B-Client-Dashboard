/** Indian-format currency. `₹12,45,000` — no decimals unless asked. */
export function inr(n: number | null | undefined, opts: { paise?: boolean } = {}) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: opts.paise ? 2 : 0,
    minimumFractionDigits: opts.paise ? 2 : 0,
  }).format(n)
}

/** `₹1.25 L`, `₹2.5 Cr` — for tiles and progress labels, never for money owed. */
export function inrShort(n: number | null | undefined) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  const abs = Math.abs(n)
  if (abs >= 1e7) return `₹${trim(n / 1e7)} Cr`
  if (abs >= 1e5) return `₹${trim(n / 1e5)} L`
  if (abs >= 1e3) return `₹${trim(n / 1e3)} K`
  return inr(n)
}

function trim(n: number) {
  return n.toFixed(n < 10 ? 2 : 1).replace(/\.0+$/, '').replace(/(\.\d)0$/, '$1')
}

export function num(n: number | null | undefined, dp = 2) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: dp }).format(n)
}

export function pct(n: number | null | undefined, dp = 0) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return `${n.toFixed(dp)}%`
}

const DATE = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
const TIME = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })

export function date(v: string | Date | null | undefined) {
  if (!v) return '—'
  const d = typeof v === 'string' ? new Date(v) : v
  return Number.isNaN(d.getTime()) ? '—' : DATE.format(d)
}

/** `09 Sep, 1:00 pm` — the shape a referral timeline needs. */
export function dateTime(v: string | Date | null | undefined) {
  if (!v) return '—'
  const d = typeof v === 'string' ? new Date(v) : v
  return Number.isNaN(d.getTime()) ? '—' : TIME.format(d)
}

export function relative(v: string | Date | null | undefined) {
  if (!v) return '—'
  const d = typeof v === 'string' ? new Date(v) : v
  const days = Math.round((Date.now() - d.getTime()) / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days}d ago`
  if (days < 365) return `${Math.round(days / 30)}mo ago`
  return `${Math.round(days / 365)}y ago`
}

/**
 * Ten bare digits, or null. Used everywhere a phone is a JOIN KEY into
 * Material Depot's systems — an architect's referral is matched to an order by
 * exact phone, so `+91 98765 43210` and `9876543210` must land on one value and
 * anything that is not a real ten-digit mobile must land on null rather than a
 * best guess.
 */
export function phone10(raw: string | null | undefined): string | null {
  if (!raw) return null
  let d = raw.replace(/\D/g, '')
  if (d.length > 10) d = d.slice(-10)
  return /^[6-9]\d{9}$/.test(d) ? d : null
}
