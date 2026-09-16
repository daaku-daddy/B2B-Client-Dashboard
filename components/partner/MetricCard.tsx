import Link from 'next/link'
import { ArrowDownRight, ArrowRight, ArrowUpRight, Minus } from 'lucide-react'
import { Tone } from '@/components/ui'
import { cn } from '@/lib/cn'

/**
 * §8.2.2 — "Each card shows the value, the delta vs the previous equivalent
 * period, and is click-through to the filtered underlying list."
 *
 * Two details the PRD is specific about and that are easy to get wrong:
 *
 * **The range is in the card header.** Not only in the picker. §8.2.2 asks for
 * it "to avoid ambiguity", and the ambiguity is expensive: a revenue figure with
 * no period on it reads as a lifetime total, which is the number a partner would
 * quote back at their KAM.
 *
 * **A delta against a zero previous period is not "+100%".** It is "first in
 * this period", because a percentage change from nothing is arithmetic, not
 * information.
 */
export function MetricCard({
  label,
  value,
  hint,
  range,
  delta,
  href,
  tone,
}: {
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
  range: string
  delta?: { now: number; before: number; format?: (n: number) => string } | null
  href?: string
  tone?: Tone
}) {
  const body = (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-[11px] font-medium tracking-wide text-ink-faint uppercase">{label}</div>
        {href ? <ArrowRight size={13} className="shrink-0 text-ink-faint transition group-hover:text-brand" /> : null}
      </div>
      <div className="mt-0.5 text-[10px] text-ink-faint">{range}</div>
      <div
        className={cn(
          'tnum mt-1 font-display text-[22px] leading-tight font-semibold',
          tone === 'good' && 'text-good',
          tone === 'bad' && 'text-bad',
          tone === 'brand' && 'text-brand',
        )}
      >
        {value}
      </div>
      {delta ? <Delta {...delta} /> : null}
      {hint ? <div className="mt-0.5 text-[11px] text-ink-faint">{hint}</div> : null}
    </>
  )

  const cls = 'block rounded-[var(--radius-card)] border border-line bg-surface p-3.5'
  return href ? (
    <Link href={href} className={cn(cls, 'group transition hover:border-line-strong hover:bg-raised')}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}

function Delta({ now, before, format }: { now: number; before: number; format?: (n: number) => string }) {
  const fmt = format ?? ((n: number) => String(n))
  if (before === 0 && now === 0) {
    return <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-ink-faint"><Minus size={11} /> same as last period</div>
  }
  if (before === 0) {
    return <div className="mt-1 text-[11px] font-medium text-good">First in this period</div>
  }
  const change = now - before
  const pctChange = Math.round((change / before) * 100)
  const up = change > 0
  const flat = change === 0
  return (
    <div
      className={cn(
        'mt-1 inline-flex items-center gap-1 text-[11px] font-medium',
        flat ? 'text-ink-faint' : up ? 'text-good' : 'text-bad',
      )}
    >
      {flat ? <Minus size={11} /> : up ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
      {flat ? 'flat' : `${up ? '+' : ''}${pctChange}%`}
      <span className="font-normal text-ink-faint">vs {fmt(before)} before</span>
    </div>
  )
}
