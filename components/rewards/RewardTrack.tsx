import { Check, Lock } from 'lucide-react'
import { Badge, Progress } from '@/components/ui'
import { inr, inrShort } from '@/lib/format'
import { TIER_ICON, type RewardStatus, type TierProgress } from '@/lib/domain/rewards'
import { cn } from '@/lib/cn'

/**
 * The incentive ladder. Six milestones, cumulative, with the next one always
 * the loudest thing on the page — the whole point is that a partner can see
 * how close the next coin is without doing arithmetic.
 */
export function RewardTrack({ status, compact = false }: { status: RewardStatus; compact?: boolean }) {
  const { next } = status

  return (
    <div>
      <div className="mb-4 rounded-[var(--radius-card)] border border-brand-line bg-brand-soft px-4 py-3.5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold tracking-wide text-brand uppercase">
              Business you have sent Material Depot
            </p>
            <p className="tnum font-display text-3xl leading-tight font-semibold text-ink">
              {inr(status.attributedSale)}
            </p>
          </div>
          {next ? (
            <div className="text-right">
              <p className="text-[11px] font-medium text-ink-soft">
                {inrShort(next.remaining)} more unlocks
              </p>
              <p className="font-display text-sm font-semibold text-ink">
                {TIER_ICON[next.tier.kind]} {next.tier.label}
              </p>
            </div>
          ) : status.complete ? (
            <Badge tone="good">Every milestone earned 🎉</Badge>
          ) : (
            <Badge tone="warn">No ladder configured</Badge>
          )}
        </div>

        {next ? (
          <div className="mt-3">
            <Progress pct={next.progressPct} tone={next.tier.kind === 'gold' ? 'gold' : 'brand'} />
            <div className="mt-1.5 flex justify-between text-[11px] text-ink-soft">
              <span>{status.earned.length} of {status.tiers.length} earned</span>
              <span className="tnum">{next.progressPct}% of the way to {inrShort(next.tier.threshold)}</span>
            </div>
          </div>
        ) : null}
      </div>

      <ol className={cn('grid gap-2.5', compact ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3')}>
        {status.tiers.map((t) => (
          <TierCard key={t.tier.id} t={t} isNext={next?.tier.id === t.tier.id} />
        ))}
      </ol>
    </div>
  )
}

function TierCard({ t, isNext }: { t: TierProgress; isNext: boolean }) {
  const handedOver = t.claim?.status === 'fulfilled'

  return (
    <li
      className={cn(
        'relative rounded-[var(--radius-card)] border p-3.5 transition',
        t.unlocked
          ? 'border-good/30 bg-good-soft/40'
          : isNext
            ? 'border-brand bg-surface shadow-[0_1px_0_var(--color-brand-line)]'
            : 'border-line bg-surface',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-display text-sm font-semibold text-ink">
            <span aria-hidden className={cn('text-base', !t.unlocked && !isNext && 'opacity-40 saturate-0')}>
              {TIER_ICON[t.tier.kind]}
            </span>
            <span className="truncate">{t.tier.label}</span>
          </p>
          <p className="tnum mt-0.5 text-xs text-ink-soft">
            at {inrShort(t.tier.threshold)} of sales
          </p>
        </div>

        {t.unlocked ? (
          <Badge tone={handedOver ? 'good' : 'warn'}>
            {handedOver ? <><Check size={11} /> Received</> : 'Ready to claim'}
          </Badge>
        ) : isNext ? (
          <Badge tone="brand">Up next</Badge>
        ) : (
          <Lock size={13} className="mt-0.5 shrink-0 text-ink-faint" />
        )}
      </div>

      {!t.unlocked ? (
        <div className="mt-2.5">
          <Progress pct={t.progressPct} tone={isNext ? 'brand' : 'silver'} />
          <p className="tnum mt-1 text-[11px] text-ink-faint">{inr(t.remaining)} to go</p>
        </div>
      ) : (
        <p className="mt-2.5 text-[11px] text-ink-faint">
          {handedOver && t.claim?.fulfilled_on
            ? `Handed over on ${t.claim.fulfilled_on}`
            : 'Your Material Depot contact will arrange the handover.'}
        </p>
      )}
    </li>
  )
}
