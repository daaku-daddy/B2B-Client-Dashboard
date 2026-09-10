import { listReferralOrders, listReferrals, listRewardClaims, listRewardTiers } from '@/lib/data/queries'
import { rewardStatus } from '@/lib/domain/rewards'
import { RewardTrack } from '@/components/rewards/RewardTrack'
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

  const attributed = orders.data.reduce((s, o) => s + Number(o.order_value || 0), 0)
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
          label="Referred orders"
          value={orders.data.length}
          hint={`across ${referrals.data.length} referred client${referrals.data.length === 1 ? '' : 's'}`}
        />
        <Stat
          label="Next milestone needs"
          value={status.next ? inr(status.next.remaining) : '—'}
          hint={status.next ? status.next.tier.label : 'Nothing left to unlock'}
        />
      </div>

      <div className="mt-5">
        <RewardTrack status={status} />
      </div>

      <Card className="mt-5">
        <CardHead
          title="What counts towards this"
          hint="Every order your referred clients placed with Material Depot. Counted once per order — re-syncing cannot inflate it."
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
                <Th className="text-right">Value</Th>
              </tr>
            </thead>
            <tbody>
              {orders.data.map((o) => (
                <tr key={o.id}>
                  <Td className="font-mono text-xs">{o.md_enq_id}</Td>
                  <Td>{refName.get(o.referral_id) ?? '—'}</Td>
                  <Td className="text-ink-soft">{o.store ?? '—'}</Td>
                  <Td className="text-ink-soft">{date(o.ordered_on)}</Td>
                  <Td className="tnum text-right font-medium">{inr(o.order_value)}</Td>
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
