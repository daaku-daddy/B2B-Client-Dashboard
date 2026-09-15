import { notFound } from 'next/navigation'
import { requireStaff } from '@/lib/data/session'
import {
  getPartner, listActivityFor, listClaimsFor, listOrdersFor, listReferralsFor, listStaff,
} from '@/lib/data/console-queries'
import { listRewardTiers } from '@/lib/data/queries'
import { supabaseServer } from '@/lib/supabase/server'
import { PartnerDetail } from '@/components/console/PartnerDetail'
import { partnerStanding } from '@/lib/domain/tiering'
import { PageHead } from '@/components/shell/PageHead'
import { Problem } from '@/components/ui'
import type { PortfolioItem } from '@/lib/domain/types'

export default async function ConsolePartnerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [staff, partner] = await Promise.all([requireStaff(), getPartner(id)])

  if (!staff.ok) {
    return (
      <>
        <PageHead title="Firm" />
        <div className="px-4 py-5 md:px-6"><Problem title="You cannot open this" detail={staff.error} /></div>
      </>
    )
  }
  if (!partner.ok) {
    return (
      <>
        <PageHead title="Firm" />
        <div className="px-4 py-5 md:px-6"><Problem title="This firm could not be loaded" detail={partner.error} /></div>
      </>
    )
  }
  // Nothing back from an RLS-scoped read is "not yours to see", which for a
  // staff member out of market is the same answer as "does not exist".
  if (!partner.data) notFound()

  const [referrals, claims, tiers, activity, team] = await Promise.all([
    listReferralsFor(id), listClaimsFor(id), listRewardTiers(), listActivityFor(id), listStaff(),
  ])

  const orders = await listOrdersFor(referrals.ok ? referrals.data.map((r) => r.id) : [])

  const sb = await supabaseServer()
  const portfolio = await sb
    .from('portfolio_item').select('*').eq('partner_id', id).order('sort_order')

  const problems = [
    !referrals.ok ? referrals.error : null,
    !orders.ok ? orders.error : null,
    !claims.ok ? claims.error : null,
    !tiers.ok ? tiers.error : null,
    !activity.ok ? activity.error : null,
    portfolio.error ? `Could not load their portfolio: ${portfolio.error.message}` : null,
  ].filter((v): v is string => Boolean(v))

  return (
    <>
      <PageHead
        title={partner.data.firm_name}
        crumbs={[{ href: '/console/partners', label: 'Firms' }, { label: partner.data.firm_name }]}
      />
      <div className="px-4 py-5 md:px-6">
        <PartnerDetail
          partner={partner.data}
          standing={partnerStanding(orders.ok ? orders.data : [])}
          referrals={referrals.ok ? referrals.data : []}
          orders={orders.ok ? orders.data : []}
          claims={claims.ok ? claims.data : []}
          tiers={tiers.ok ? tiers.data : []}
          activity={activity.ok ? activity.data : []}
          portfolio={(portfolio.data ?? []) as PortfolioItem[]}
          team={team.ok ? team.data : []}
          isAdmin={staff.data.role === 'admin'}
          problems={problems}
        />
      </div>
    </>
  )
}
