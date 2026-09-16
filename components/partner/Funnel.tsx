import type { FunnelStage } from '@/lib/domain/ledger'
import { Card, CardHead } from '@/components/ui'

/**
 * §8.2.4 — "Referred → Visited store → Cart created → Ordered, as a horizontal
 * funnel with counts and conversion percentages for the selected range."
 *
 * Counted on CLIENTS, not on events, and that is not a detail. Material Depot's
 * field apps log one real store arrival several times — twenty, in a case
 * `docs/referrals.md` records — so a funnel counting visit EVENTS would show
 * more store visits than referrals and read as broken to the one person on the
 * platform who knows exactly how many clients they sent.
 */
export function Funnel({ stages, range }: { stages: FunnelStage[]; range: string }) {
  const top = stages[0]?.count ?? 0
  return (
    <Card>
      <CardHead
        title="Where your clients got to"
        hint={`${range} · each step is a person, not a visit — one client walking in three times is one client`}
      />
      <div className="space-y-2.5 px-4 py-4">
        {stages.map((s, i) => (
          <div key={s.key}>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="font-medium text-ink">{s.label}</span>
              <span className="tnum shrink-0 text-ink-soft">
                {s.count}
                {s.pctOfPrevious !== null ? (
                  <span className="ml-2 text-xs text-ink-faint">{s.pctOfPrevious}% of the step before</span>
                ) : null}
              </span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-line">
              <div
                className={i === stages.length - 1 ? 'h-full rounded-full bg-good' : 'h-full rounded-full bg-brand'}
                style={{ width: `${top > 0 ? Math.max(s.pctOfTop, s.count > 0 ? 3 : 0) : 0}%` }}
              />
            </div>
          </div>
        ))}
        {top === 0 ? (
          <p className="pt-1 text-xs text-ink-faint">
            Nothing in this period yet. Refer a client and each step fills in as they move through.
          </p>
        ) : null}
      </div>
    </Card>
  )
}
