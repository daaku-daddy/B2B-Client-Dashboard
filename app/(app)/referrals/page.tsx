import Link from 'next/link'
import { listClients, listReferralEvents, listReferralOrders, listReferrals, listRewardClaims, listRewardTiers } from '@/lib/data/queries'
import { ReferralsView } from '@/components/referrals/ReferralsView'
import { PageHead } from '@/components/shell/PageHead'
import { Problem, Stat } from '@/components/ui'
import { attributedSale, pendingSale, rewardStatus } from '@/lib/domain/rewards'
import { inr, inrShort } from '@/lib/format'

export default async function ReferralsPage() {
  const [referrals, clients, tiers, claims] = await Promise.all([
    listReferrals(), listClients(), listRewardTiers(), listRewardClaims(),
  ])

  if (!referrals.ok) {
    return (
      <>
        <PageHead title="Referrals" />
        <div className="px-4 py-5 md:px-6"><Problem title="Referrals could not be loaded" detail={referrals.error} /></div>
      </>
    )
  }

  const ids = referrals.data.map((r) => r.id)
  const [events, orders] = await Promise.all([listReferralEvents(ids, 500), listReferralOrders(ids)])

  // Approved only, everywhere. See lib/domain/rewards.ts.
  const attributed = orders.ok ? attributedSale(orders.data) : 0
  const waiting = orders.ok ? pendingSale(orders.data) : { count: 0, value: 0 }
  const status = rewardStatus(attributed, tiers.ok ? tiers.data : [], claims.ok ? claims.data : [])

  return (
    <>
      <PageHead
        title="Your clients"
        hint="Clients you have sent to Material Depot. You see what they saw, what is in their cart, and what they ordered."
      />
      <div className="space-y-5 px-4 py-5 md:px-6">
        {!orders.ok ? <Problem title="Order values are missing" detail={orders.error} /> : null}

        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Referred clients" value={referrals.data.length} hint={`${orders.ok ? orders.data.length : 0} orders between them`} />
          <Stat
            label="Business sent our way"
            value={inr(attributed)}
            hint={
              waiting.count
                ? `Verified. ${inrShort(waiting.value)} more is still being checked by us.`
                : 'Lifetime, across every referral'
            }
            tone="good"
          />
          <Stat
            label="Next reward needs"
            value={status.next ? inrShort(status.next.remaining) : 'All earned'}
            hint={
              status.next ? (
                <>
                  {status.next.tier.label} ·{' '}
                  <Link href="/rewards" className="text-brand hover:underline">see the ladder</Link>
                </>
              ) : (
                <Link href="/rewards" className="text-brand hover:underline">see the ladder</Link>
              )
            }
          />
        </div>

        <ReferralsView
          referrals={referrals.data}
          clients={clients.ok ? clients.data : []}
          events={events.ok ? events.data : []}
          orders={orders.ok ? orders.data : []}
          eventsError={events.ok ? null : events.error}
        />
      </div>
    </>
  )
}
