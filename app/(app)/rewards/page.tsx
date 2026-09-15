import { listReferralOrders, listReferrals, listRewardClaims, listRewardTiers } from '@/lib/data/queries'
import { attributedSale, pendingSale, rewardStatus } from '@/lib/domain/rewards'
import { RewardTrack } from '@/components/rewards/RewardTrack'
import { OrderApprovalBadge } from '@/components/referrals/OrderApproval'
import { PageHead } from '@/components/shell/PageHead'
import { Card, CardHead, Empty, Problem, Stat, Table, Td, Th } from '@/components/ui'
import { date, inr } from '@/lib/format'

export default async function RewardsPage() {
  const [tiers, claims, referrals] = await Promise.all([
    listRewardTiers(),
    listRewardClaims(),
    listReferrals(),
  ])

  if (!tiers.ok) return <Shell><Problem title="Could not load the rewards ladder" detail={tiers.error} /></Shell>
  if (!claims.ok) return <Shell><Problem title="Could not load your rewards" detail={claims.error} /></Shell>
  if (!referrals.ok) return <Shell><Problem title="Could not load your referrals" detail={referrals.error} /></Shell>

  const orders = await listReferralOrders(referrals.data.map((r) => r.id))
  if (!orders.ok) return <Shell><Problem title="Could not load referred orders" detail={orders.error} /></Shell>

  const attributed = attributedSale(orders.data)
  const waiting = pendingSale(orders.data)
  const status = rewardStatus(attributed, tiers.data, claims.data)
  const refName = new Map(referrals.data.map((r) => [r.id, r.client_name]))

  return (
    <Shell>
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Milestones earned"
          value={`${status.earned.length} / ${status.tiers.length}`}
          hint={status.awaitingHandover.length ? `${status.awaitingHandover.length} awaiting handover` : 'All handed over'}
          tone="brand"
        />
        <Stat
          label="Counting towards this"
          value={inr(attributed)}
          hint={
            waiting.count
              ? `${orders.data.length} order${orders.data.length === 1 ? '' : 's'} · ${inr(waiting.value)} still being checked`
              : `${orders.data.length} order${orders.data.length === 1 ? '' : 's'} across ${referrals.data.length} client${referrals.data.length === 1 ? '' : 's'}`
          }
          tone="good"
        />
        <Stat
          label="Next milestone needs"
          value={status.next ? inr(status.next.remaining) : '—'}
          hint={
            status.next
              ? status.next.tier.label
              : status.complete
                ? 'Nothing left to unlock'
                : 'The ladder is not set up yet'
          }
        />
      </div>

      <div className="mt-5">
        <RewardTrack status={status} />
      </div>

      <Card className="mt-5">
        <CardHead
          title="What counts towards this"
          hint="Every order your referred clients placed with us. Counted once per order — and only once we have verified it, which is usually a day or two after it is placed."
        />
        {orders.data.length === 0 ? (
          <Empty
            title="No referred orders yet"
            body="Refer a client and their orders start counting towards the ladder automatically — you do not have to claim them."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Order</Th>
                <Th>Client</Th>
                <Th>Store</Th>
                <Th>Placed</Th>
                <Th>Counting?</Th>
                <Th className="text-right">Value</Th>
              </tr>
            </thead>
            <tbody>
              {orders.data.map((o) => (
                <tr key={o.id}>
                  <Td className="font-mono text-xs" title={o.md_enq_id}>{o.md_enq_id}</Td>
                  <Td>{refName.get(o.referral_id) ?? '—'}</Td>
                  <Td className="text-ink-soft">{o.store ?? '—'}</Td>
                  <Td className="text-ink-soft">{date(o.ordered_on)}</Td>
                  <Td><OrderApprovalBadge status={o.approval_status} /></Td>
                  <Td
                    className={`tnum text-right font-medium ${o.approval_status === 'approved' ? '' : 'text-ink-faint'}`}
                  >
                    {inr(o.order_value)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageHead
        title="Rewards"
        hint="Six milestones, one ladder. Everything your referred clients buy counts — cumulatively, for as long as you work with us."
      />
      <div className="px-4 py-5 md:px-6">{children}</div>
    </>
  )
}
