import type { CoinMonth } from '@/lib/domain/ledger'
import { MILESTONE_ICON, MILESTONE_LABEL } from '@/lib/domain/slabs'
import { Card, CardHead } from '@/components/ui'
import { inrShort } from '@/lib/format'

/**
 * The coin wall — PRD §10.5.3.
 *
 * "Because coins are earned per month, show a calendar strip of the trailing 12
 * months with the coin earned in each — this is the honest representation of a
 * monthly programme and reads better than a single lifetime badge."
 *
 * The honesty matters more than the reading. A lifetime badge on a monthly
 * programme implies a ladder that only goes up, and the first month a partner
 * does ₹40,000 they would find a badge they thought they owned quietly missing.
 * Twelve squares cannot lie about that: the good months stay good, and the
 * blank ones stay blank.
 *
 * It is also §18's stated mitigation for "monthly slab resets demotivate
 * mid-sized partners" — effort is visibly cumulative across the strip even
 * though the slab resets on the 1st.
 */
export function CoinWall({ months }: { months: CoinMonth[] }) {
  const earned = months.filter((m) => m.milestone).length
  const live = months.filter((m) => !m.preProgramme)

  return (
    <Card>
      <CardHead
        title="Your year"
        hint={
          earned
            ? `${earned} milestone${earned === 1 ? '' : 's'} in the last 12 months. Each one is a month you reached the slab, not a lifetime badge.`
            : 'Each square is a calendar month. Reach a slab and the coin appears in that month, for good.'
        }
      />
      <div className="grid grid-cols-4 gap-2 p-4 sm:grid-cols-6 lg:grid-cols-12">
        {months.map((m) => (
          <Square key={m.period.key} m={m} />
        ))}
      </div>
      {live.length < months.length ? (
        <p className="border-t border-line px-4 py-2 text-[11px] text-ink-faint">
          Greyed months are before the programme started. Business you did with us then is real — it is in your client
          timelines — and it carries no reward value.
        </p>
      ) : null}
    </Card>
  )
}

function Square({ m }: { m: CoinMonth }) {
  const short = m.period.label.split(' ')[0]

  const tone = m.preProgramme
    ? 'border-line bg-raised text-ink-faint opacity-60'
    : m.milestone === 'gold_coin'
      ? 'border-gold/40 bg-gold/10 text-ink'
      : m.milestone === 'silver_coin'
        ? 'border-silver/40 bg-silver/10 text-ink'
        : m.milestone
          ? 'border-brand-line bg-brand-soft text-ink'
          : m.spend > 0
            ? 'border-line-strong bg-surface text-ink-soft'
            : 'border-line bg-surface text-ink-faint'

  return (
    <div
      className={`rounded-lg border px-2 py-2 text-center ${tone} ${m.open ? 'ring-1 ring-brand/30' : ''}`}
      title={
        m.preProgramme
          ? `${m.period.label} — before the programme started`
          : `${m.period.label} — ${inrShort(m.spend)}${m.milestone ? `, ${MILESTONE_LABEL[m.milestone]}` : ''}${m.confirmed ? '' : ', still confirming'}`
      }
    >
      <div className="text-[10px] font-medium tracking-wide uppercase">{short}</div>
      <div className="mt-1 text-lg leading-none">
        {m.preProgramme ? '·' : m.milestone ? MILESTONE_ICON[m.milestone] : m.spend > 0 ? '•' : '·'}
      </div>
      <div className="tnum mt-1 text-[10px]">{m.preProgramme || !m.spend ? '—' : inrShort(m.spend)}</div>
      {m.open ? <div className="mt-0.5 text-[9px] font-medium text-brand">now</div> : null}
      {!m.open && !m.confirmed && m.spend > 0 ? (
        <div className="mt-0.5 text-[9px] text-warn">confirming</div>
      ) : null}
    </div>
  )
}
