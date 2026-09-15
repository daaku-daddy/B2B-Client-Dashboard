import { Badge, type Tone } from '@/components/ui'
import { ENGAGEMENT, USAGE_TIER, type PartnerStanding } from '@/lib/domain/tiering'

/**
 * The internal read on a firm: how much they buy, and whether they have gone
 * quiet.
 *
 * **Never rendered in the partner app.** Telling an architect they are a "Basic
 * User" is a way to lose them. This lives under `components/console/` and is
 * imported by console pages only — if you find yourself importing it from
 * anything under `app/(app)/`, that is the bug.
 */
export function TierBadge({ standing }: { standing: PartnerStanding }) {
  const t = USAGE_TIER[standing.tier]
  return (
    <Badge tone={t.tone as Tone} title={`${t.blurb} — ${standing.orderCount} verified`}>
      {t.label}
    </Badge>
  )
}

export function EngagementBadge({ standing }: { standing: PartnerStanding }) {
  const e = ENGAGEMENT[standing.engagement]
  const detail =
    standing.engagement === 'never_ordered'
      ? 'Onboarded but has never had an order come through'
      : standing.daysSinceOrder === null
        ? undefined
        : `Last verified order ${standing.daysSinceOrder} days ago`
  return <Badge tone={e.tone as Tone} title={detail}>{e.label}</Badge>
}
