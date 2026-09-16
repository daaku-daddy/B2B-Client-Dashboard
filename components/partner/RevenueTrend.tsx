import type { CoinMonth } from '@/lib/domain/ledger'
import { MILESTONE_ICON, MONTHLY_SLABS } from '@/lib/domain/slabs'
import { Card, CardHead } from '@/components/ui'
import { inrShort } from '@/lib/format'

/**
 * §8.2.3 — "Bar chart of attributed revenue by month for the trailing 12
 * months, **with slab thresholds drawn as reference lines** so the partner can
 * see how often they land just below a slab. Hover shows order count."
 *
 * The reference lines are the whole point of this chart and the reason it is not
 * a generic revenue sparkline. A partner who can see that four of their last six
 * months finished within ₹30,000 of the next band will change what they do in
 * the last week of a month, and that is precisely the behaviour the programme
 * is trying to buy.
 *
 * ## Why this is CSS and not recharts
 *
 * §14.4 puts Overview TTI under 2.5s on 4G. A charting library is ~100KB of
 * client JavaScript and a hydration boundary for twelve rectangles. This renders
 * on the server, ships no JavaScript at all, and still gets the hover through a
 * `title` — which also means it works with a keyboard and a screen reader, which
 * a canvas chart does not.
 */
export function RevenueTrend({ months, orderCounts }: { months: CoinMonth[]; orderCounts: Map<string, number> }) {
  const peak = Math.max(...months.map((m) => m.spend), 0)
  // Show reference lines up to the band above the partner's best month, so a
  // firm doing ₹1.5 L a month is not looking at a chart scaled for ₹10 L with
  // their own bars as slivers along the bottom.
  const relevant = MONTHLY_SLABS.filter((s, i) => s.floor <= peak * 1.6 || i === 0).slice(0, 4)
  const topBand = relevant[relevant.length - 1]
  const ceiling = Math.max(peak * 1.15, topBand ? topBand.floor * 1.1 : 0, 1)

  const anyData = months.some((m) => m.spend > 0)

  return (
    <Card>
      <CardHead
        title="Month by month"
        hint={
          anyData
            ? 'Attributed revenue, with the slab thresholds drawn across. The dotted lines are what each month was reaching for.'
            : 'Attributed revenue by month. The dotted lines are the slab thresholds — the first one is where the programme starts paying.'
        }
      />
      <div className="px-4 pt-5 pb-3">
        {/* The threshold labels get their OWN column rather than floating over
            the plot. Drawn on top of the bars they were unreadable the moment a
            month reached the band they were labelling — which is exactly the
            month a partner is looking at them for. */}
        <div className="relative h-44 pr-14">
          {relevant.map((s) => {
            const y = Math.min(98, (s.floor / ceiling) * 100)
            return (
              <div key={s.id} className="pointer-events-none absolute inset-x-0" style={{ bottom: `${y}%` }}>
                <div className="border-t border-dashed border-line-strong" />
                <span className="absolute -top-2 -right-14 w-14 pl-1.5 text-[10px] whitespace-nowrap text-ink-faint">
                  {inrShort(s.floor - 1)}
                  {s.milestone ? ` ${MILESTONE_ICON[s.milestone]}` : ''}
                </span>
              </div>
            )
          })}

          <div className="absolute inset-y-0 right-14 left-0 flex items-end gap-1">
            {months.map((m) => {
              const h = ceiling > 0 ? Math.min(100, (m.spend / ceiling) * 100) : 0
              const n = orderCounts.get(m.period.key) ?? 0
              return (
                <div
                  key={m.period.key}
                  className="group relative flex h-full flex-1 items-end"
                  title={
                    m.preProgramme
                      ? `${m.period.label} — before the programme started`
                      : `${m.period.label} — ${inrShort(m.spend)} across ${n} order${n === 1 ? '' : 's'}${m.milestone ? `, ${MILESTONE_ICON[m.milestone]}` : ''}`
                  }
                >
                  {/* A pre-programme month is drawn as an OUTLINE, not as a
                      grey fill. The silver-coin fill is also grey, so filling
                      both meant the caption "grey bars carry no reward value"
                      was pointing at the month that earned a Silver Coin. */}
                  <div
                    className={[
                      'w-full rounded-t transition-all',
                      m.preProgramme
                        ? 'border border-b-0 border-dashed border-line-strong bg-transparent'
                        : m.milestone === 'gold_coin'
                          ? 'bg-gold'
                          : m.milestone === 'silver_coin'
                            ? 'bg-silver'
                            : m.spend > 0
                              ? 'bg-brand'
                              : 'bg-line',
                      m.open ? 'opacity-70' : '',
                    ].join(' ')}
                    style={{ height: `${Math.max(h, m.spend > 0 ? 3 : 1)}%` }}
                  />
                </div>
              )
            })}
          </div>
        </div>

        <div className="mt-1.5 flex gap-1 pr-14">
          {months.map((m) => (
            <div key={m.period.key} className="flex-1 text-center text-[10px] text-ink-faint">
              {m.period.label.split(' ')[0].slice(0, 1)}
            </div>
          ))}
        </div>
      </div>
      <p className="border-t border-line px-4 py-2 text-[11px] text-ink-faint">
        The current month is faded because it is not finished. A silver or gold bar is a month that reached that coin.
        {months.some((m) => m.preProgramme)
          ? ' Outlined months are before the programme started and carry no reward value.'
          : ''}
      </p>
    </Card>
  )
}
