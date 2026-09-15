import { requireStaff } from '@/lib/data/session'
import { listAllOrders, listPartners, listStaff } from '@/lib/data/console-queries'
import { PartnerDirectory, type PartnerRow } from '@/components/console/PartnerDirectory'
import { partnerStanding } from '@/lib/domain/tiering'
import { PageHead } from '@/components/shell/PageHead'
import { Problem } from '@/components/ui'
import type { ReferralOrder } from '@/lib/domain/types'

export default async function PartnersPage() {
  const [staff, partners, orders, team] = await Promise.all([
    requireStaff(), listPartners(), listAllOrders(1000), listStaff(),
  ])

  if (!staff.ok) {
    return (
      <>
        <PageHead title="Firms" />
        <div className="px-4 py-5 md:px-6"><Problem title="You cannot open this" detail={staff.error} /></div>
      </>
    )
  }

  // One orders query for the whole directory, bucketed in memory. The obvious
  // alternative — a query per firm — is how Material Depot has already shipped a
  // screen that made one request per row.
  const byPartner = new Map<string, ReferralOrder[]>()
  if (orders.ok) {
    for (const o of orders.data) {
      const pid = o.referral?.partner_id
      if (!pid) continue
      const list = byPartner.get(pid) ?? []
      list.push(o)
      byPartner.set(pid, list)
    }
  }

  const rows: PartnerRow[] = partners.ok
    ? partners.data.map((partner) => ({
        partner,
        standing: partnerStanding(byPartner.get(partner.id) ?? []),
      }))
    : []

  return (
    <>
      <PageHead
        title={staff.data.role === 'kam' ? 'My firms' : 'Firms'}
        hint="Everyone with a login. Who they are, who looks after them, and whether they have gone quiet."
      />
      <div className="px-4 py-5 md:px-6">
        {orders.ok ? null : (
          <div className="mb-4">
            <Problem
              title="Order history could not be loaded"
              detail={`${orders.error} — every firm below will read as "no orders yet", which is not the same as having none. Do not act on the classification until this loads.`}
            />
          </div>
        )}
        <PartnerDirectory rows={rows} team={team.ok ? team.data : []} error={partners.ok ? null : partners.error} />
      </div>
    </>
  )
}
