import Link from 'next/link'
import { ArrowLeft, Eye, EyeOff } from 'lucide-react'
import { Badge, Card, CardHead, Empty, Problem, Stat, Table, Td, Th } from '@/components/ui'
import { RewardTrack } from '@/components/rewards/RewardTrack'
import { ReferralFeed } from '@/components/referrals/ReferralFeed'
import { ActivityFeed } from '@/components/partner/ActivityFeed'
import { KamCard } from '@/components/partner/KamCard'
import { OrderApprovalBadge } from '@/components/referrals/OrderApproval'
import { attributedSale, pendingSale, rewardStatus } from '@/lib/domain/rewards'
import type {
  MyKam, Partner, PartnerActivity, PortfolioItem, Referral, ReferralEvent, ReferralOrder,
  RewardClaim, RewardTier,
} from '@/lib/domain/types'
import { date, inr, inrShort, relative } from '@/lib/format'

/**
 * One firm's own dashboard, as the firm sees it, read-only.
 *
 * ## Why this is not a second version of `PartnerDetail`
 *
 * `PartnerDetail` is Material Depot's read on a firm: internal classification,
 * the reactivation clock, the internal note, the settings only an admin can
 * change. This page is the opposite — it deliberately shows nothing internal,
 * and every number on it is computed with the **partner's** own functions
 * (`attributedSale`, `pendingSale`, `rewardStatus`) rather than the console's
 * `partnerStanding`. A support call is somebody reading a screen down the phone,
 * and the figure the admin reads out has to be the figure the architect is
 * looking at, to the rupee.
 *
 * Nothing from `lib/domain/tiering.ts` may be imported here for the same reason
 * it may not be imported into the partner app: Power/Mid/Basic is how a KAM
 * plans their week, not something to read out to a firm.
 *
 * ## What it cannot show, and why that is said out loud
 *
 * The project workspace — clients, projects, rooms, boards, quotes,
 * procurement, the ledger — is absent, because staff have no read policy on any
 * of those nine tables and must never get one (`docs/roles.md`). That is the
 * whole reason a designer would put their pricing in a supplier's portal. The
 * page says so where the modules would have been rather than quietly ending, so
 * nobody reads the gap as a page that failed to load and goes looking for a bug.
 *
 * ## History is filtered here, on purpose
 *
 * `partner_activity` carries internal rows a firm never sees; RLS hides them
 * from the partner, not from staff. This view filters to `visible_to_partner`
 * itself and says how many rows it dropped — the unfiltered history is one
 * click away on the firm page, and a mirror that showed a KAM's private note as
 * something the firm can read would be worse than no mirror.
 */
export function PartnerAsSeen({
  partner,
  kam,
  referrals,
  orders,
  events,
  tiers,
  claims,
  activity,
  portfolio,
  problems,
}: {
  partner: Partner
  kam: MyKam | null
  referrals: Referral[]
  orders: ReferralOrder[]
  events: ReferralEvent[]
  tiers: RewardTier[]
  claims: RewardClaim[]
  /** Every history row for the firm, internal ones included — filtered below. */
  activity: PartnerActivity[]
  portfolio: PortfolioItem[]
  problems: string[]
}) {
  const firstName = partner.contact_name.split(' ')[0]

  // The partner's own arithmetic, not the console's. See the note above.
  const approved = attributedSale(orders)
  const waiting = pendingSale(orders)
  const status = rewardStatus(approved, tiers, claims)

  const theirs = activity.filter((a) => a.visible_to_partner)
  const internalCount = activity.length - theirs.length

  const names = new Map(referrals.map((r) => [r.id, r.client_name]))

  const perClient = referrals.map((r) => {
    const mine = orders.filter((o) => o.referral_id === r.id)
    const lastEvent = events.find((e) => e.referral_id === r.id) ?? null
    return {
      referral: r,
      orders: mine.length,
      value: mine.filter((o) => o.approval_status === 'approved')
        .reduce((s, o) => s + (Number(o.order_value) || 0), 0),
      pending: mine.filter((o) => o.approval_status === 'pending').length,
      last: lastEvent?.occurred_at ?? null,
    }
  })

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-[var(--radius-card)] border border-line bg-raised px-4 py-3">
        <div className="flex gap-3">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
            <Eye size={15} />
          </span>
          <div className="min-w-0">
            <p className="font-display text-sm font-semibold text-ink">
              This is {partner.firm_name}’s own dashboard, exactly as they see it
            </p>
            <p className="mt-0.5 max-w-3xl text-xs leading-relaxed text-ink-soft">
              Read-only. Nothing on this page can be edited from here, and nothing internal appears on it —
              no classification, no reactivation clock, no internal note. Every figure is worked out the way
              their screen works it out, so it is safe to read one down the phone to them. To change
              anything, go back to the firm.
            </p>
          </div>
        </div>
        <Link
          href={`/console/partners/${partner.id}`}
          className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-brand hover:underline"
        >
          <ArrowLeft size={13} /> Back to the firm
        </Link>
      </div>

      {problems.length ? (
        <Problem title="Some of this page could not load" detail={problems.join(' · ')} />
      ) : null}

      <Card className="border-0 bg-transparent">
        <p className="font-display text-lg font-semibold tracking-tight text-ink">
          Good to see you, {firstName}
        </p>
        <p className="text-sm text-ink-soft">
          What the clients you sent us have been doing, and where that has got you.
        </p>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Clients you sent us"
          value={referrals.length}
          hint={`${orders.length} order${orders.length === 1 ? '' : 's'} between them`}
        />
        <Stat label="Business sent our way" value={inrShort(approved)} hint="Verified and counting" tone="good" />
        <Stat
          label="Being checked"
          value={waiting.count ? inrShort(waiting.value) : '—'}
          hint={
            waiting.count
              ? `${waiting.count} order${waiting.count === 1 ? '' : 's'} we are confirming`
              : 'Nothing waiting on us'
          }
          tone={waiting.count ? 'brand' : undefined}
        />
        <Stat
          label="Next reward needs"
          value={status.next ? inr(status.next.remaining) : status.complete ? 'All earned' : '—'}
          hint={
            status.next
              ? status.next.tier.label
              : status.complete
                ? 'Every milestone unlocked'
                : 'The ladder did not load — so theirs did not either'
          }
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <Card>
          <CardHead title="Their referred clients" hint="What those clients did at Material Depot" />
          <ReferralFeed
            events={events}
            names={names}
            emptyBody={
              referrals.length
                ? 'Nothing has come through for their referred clients yet. Visits, carts and orders appear here as they happen — which today means nothing is pushing to /api/sync/referrals.'
                : 'They have not told us about a client yet, so there is nothing to show them.'
            }
          />
        </Card>

        <div className="space-y-5">
          <KamCard kam={kam} />
          <Card>
            <CardHead
              title="Their account with us"
              hint="What they can see of what we have done"
            />
            <ActivityFeed items={theirs} />
            {internalCount ? (
              <p className="flex items-center gap-1.5 border-t border-line px-4 py-2 text-[11px] text-ink-faint">
                <EyeOff size={12} />
                {internalCount} internal {internalCount === 1 ? 'row is' : 'rows are'} hidden from them —
                the full history is on{' '}
                <Link href={`/console/partners/${partner.id}`} className="font-medium text-brand hover:underline">
                  the firm page
                </Link>
                .
              </p>
            ) : null}
          </Card>
        </div>
      </div>

      <div>
        <div className="mb-3">
          <h2 className="font-display text-[15px] font-semibold tracking-tight text-ink">Their rewards ladder</h2>
          <p className="text-xs text-ink-faint">
            Cumulative, across every client they have sent us. Verified orders only.
          </p>
        </div>
        {tiers.length === 0 ? (
          <Card><Empty title="No ladder configured" body="reward_tier is empty, so their Rewards page is empty too." /></Card>
        ) : (
          <RewardTrack status={status} />
        )}
      </div>

      <Card>
        <CardHead title="Client by client" hint="The same table they see under Your clients" />
        {perClient.length === 0 ? (
          <Empty
            title="No referrals yet"
            body="They have not told us about a client yet — which is usually the thing to talk to them about."
          />
        ) : (
          <Table className="min-w-[680px]">
            <thead>
              <tr>
                <Th>Client</Th><Th>Referred</Th><Th className="text-right">Orders</Th>
                <Th className="text-right">Counted</Th><Th>Last activity</Th>
              </tr>
            </thead>
            <tbody>
              {perClient.map((row) => (
                <tr key={row.referral.id}>
                  <Td>
                    <p className="text-sm text-ink">{row.referral.client_name}</p>
                    <p className="tnum text-[11px] text-ink-faint">{row.referral.md_phone}</p>
                  </Td>
                  <Td className="text-xs text-ink-soft">{date(row.referral.referred_on)}</Td>
                  <Td className="tnum text-right text-xs">
                    {row.orders || '—'}
                    {row.pending ? <Badge tone="warn" className="ml-1">{row.pending} being checked</Badge> : null}
                  </Td>
                  <Td className="tnum text-right text-xs font-medium text-good">
                    {row.value ? inr(row.value) : '—'}
                  </Td>
                  <Td className="text-xs text-ink-soft">{row.last ? relative(row.last) : '—'}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Card>
        <CardHead title="Their orders" hint="Every order their referred clients placed, in their words" />
        {orders.length === 0 ? (
          <Empty title="No orders yet" body="Nothing their referred clients have bought has reached us." />
        ) : (
          <Table className="min-w-[560px]">
            <thead>
              <tr><Th>Order</Th><Th>Client</Th><Th>Placed</Th><Th>State</Th><Th className="text-right">Value</Th></tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <Td className="font-mono text-[11px]" title={o.md_enq_id}>{o.md_enq_id}</Td>
                  <Td className="text-xs">{names.get(o.referral_id) ?? '—'}</Td>
                  <Td className="text-xs text-ink-soft">{date(o.ordered_on)}</Td>
                  <Td><OrderApprovalBadge status={o.approval_status} /></Td>
                  <Td className="tnum text-right text-xs font-medium">{inr(o.order_value)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Card>
        <CardHead title="Their portfolio" hint="What they have sent us for materialdepot.com" />
        {portfolio.length === 0 ? (
          <Empty title="Nothing submitted" body="They have not sent us any projects yet." />
        ) : (
          <ul className="divide-y divide-line">
            {portfolio.map((p) => (
              <li key={p.id} className="flex items-start gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{p.title}</p>
                  {p.summary ? <p className="line-clamp-2 text-xs text-ink-soft">{p.summary}</p> : null}
                  <p className="mt-0.5 text-[11px] text-ink-faint">
                    {[p.city, p.project_type, p.area_sqft ? `${p.area_sqft} sq ft` : null,
                      p.completed_on ? `completed ${date(p.completed_on)}` : null]
                      .filter(Boolean).join(' · ') || '—'}
                  </p>
                  {p.status === 'rejected' && p.review_note ? (
                    <p className="mt-1 text-[11px] text-warn">Sent back: {p.review_note}</p>
                  ) : null}
                </div>
                <Badge tone={p.status === 'published' ? 'good' : p.status === 'submitted' ? 'info' : p.status === 'rejected' ? 'warn' : 'neutral'}>
                  {p.status === 'published' ? 'Live on our site'
                    : p.status === 'submitted' ? 'With Material Depot'
                    : p.status === 'rejected' ? 'Needs a change' : 'Draft'}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <div className="px-4 py-4">
          <h2 className="font-display text-[15px] font-semibold tracking-tight text-ink">
            {partner.workspace_enabled
              ? 'They also have the project workspace, and it is not shown here'
              : 'The project workspace is off for this firm'}
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-ink-soft">
            {partner.workspace_enabled ? (
              <>
                Design boards, client quotes with their own markup, a procurement list and a project P&amp;L are
                switched on for {partner.firm_name}. <strong className="text-ink">Nobody at Material Depot can
                read any of it</strong> — not you, not an admin, not support. The database has no read policy
                for staff on their clients, projects, boards, quotes, procurement or ledger, and that is the
                only reason a designer would put their pricing in a supplier’s portal at all. This gap is not a
                page that failed to load.
              </>
            ) : (
              <>
                Design boards, client quotes, procurement and a project P&amp;L are built and switched off for
                this firm — turn them on from the firm page when they ask. Either way nobody at Material Depot
                can read what a firm puts in them, so they would not appear here even with the flag on.
              </>
            )}
          </p>
        </div>
      </Card>
    </div>
  )
}
