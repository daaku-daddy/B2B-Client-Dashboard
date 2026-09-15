import { Award, CheckCircle2, GalleryVerticalEnd, Handshake, MessageSquare, UserRound } from 'lucide-react'
import type { PartnerActivity } from '@/lib/domain/types'
import { Empty, Problem } from '@/components/ui'
import { dateTime } from '@/lib/format'

const ICON: Record<string, typeof Handshake> = {
  onboarded: Handshake,
  kam_assigned: UserRound,
  order_approved: CheckCircle2,
  reward: Award,
  portfolio: GalleryVerticalEnd,
  note: MessageSquare,
}

/**
 * What Material Depot has done with this firm, in the firm's own view.
 *
 * Rows staff marked internal never reach here — RLS drops them, and this
 * component does not filter, so a policy slip would show up as a visible bug
 * rather than be quietly papered over.
 */
export function ActivityFeed({ items, error }: { items: PartnerActivity[]; error?: string | null }) {
  if (error) return <div className="p-4"><Problem title="This did not load" detail={error} /></div>
  if (!items.length) {
    return (
      <Empty
        title="Nothing yet"
        body="Milestones, verified orders and anything we publish for you will show up here."
      />
    )
  }
  return (
    <ul className="divide-y divide-line">
      {items.map((a) => {
        const Icon = ICON[a.kind] ?? MessageSquare
        return (
          <li key={a.id} className="flex gap-3 px-4 py-3">
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
              <Icon size={14} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">{a.title}</p>
              {a.detail ? <p className="text-xs text-ink-soft">{a.detail}</p> : null}
              <p className="tnum mt-0.5 text-[11px] text-ink-faint">{dateTime(a.occurred_at)}</p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
