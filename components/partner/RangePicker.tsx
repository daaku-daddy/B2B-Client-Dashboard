'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarRange } from 'lucide-react'
import { RANGE_PRESETS, type Range } from '@/lib/domain/periods'
import { EV, track } from '@/lib/analytics/track'

/**
 * §8.2.1's date range control.
 *
 * "Default: current month, because the incentive programme runs on calendar
 * months." The presets are the PRD's list in the PRD's order, and the RESOLVED
 * range is printed next to them — not just the preset name — because "This
 * quarter" and "Jul–Sep 2026" are the same fact only if you already know what
 * month it is, and a partner comparing a figure here against one their KAM sent
 * on WhatsApp needs the dates.
 *
 * It is a set of links rather than a dropdown so the page stays a server
 * component and each range is shareable.
 */
export function RangePicker({ range }: { range: Range }) {
  const pathname = usePathname()
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1.5 text-xs text-ink-faint">
        <CalendarRange size={13} />
        <span className="tnum font-medium text-ink-soft">{range.label}</span>
      </span>
      <div className="flex flex-wrap gap-1">
        {RANGE_PRESETS.map((p) => (
          <Link
            key={p.key}
            href={`${pathname}?range=${p.key}`}
            scroll={false}
            onClick={() => track(EV.date_range_changed, { range: p.key })}
            className={[
              'rounded-lg border px-2 py-1 text-xs font-medium transition',
              range.key === p.key
                ? 'border-brand bg-brand-soft text-brand'
                : 'border-line bg-surface text-ink-soft hover:border-line-strong hover:text-ink',
            ].join(' ')}
          >
            {p.label}
          </Link>
        ))}
      </div>
    </div>
  )
}
