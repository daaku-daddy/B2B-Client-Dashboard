import { requireStaff } from '@/lib/data/session'
import { listProspects, listStaff, listTouches } from '@/lib/data/console-queries'
import { ProspectBoard } from '@/components/console/ProspectBoard'
import { PageHead } from '@/components/shell/PageHead'
import { Problem } from '@/components/ui'
import { marketLabel } from '@/lib/domain/markets'

export default async function ProspectsPage() {
  const [staff, prospects, team] = await Promise.all([requireStaff(), listProspects(), listStaff()])

  if (!staff.ok) {
    return (
      <>
        <PageHead title="Outreach" />
        <div className="px-4 py-5 md:px-6"><Problem title="You cannot open this" detail={staff.error} /></div>
      </>
    )
  }

  const touches = await listTouches(prospects.ok ? prospects.data.map((p) => p.id) : [])

  return (
    <>
      <PageHead
        title="Outreach"
        hint={`Architects and interior designers we are talking to in ${marketLabel(staff.data.market).toLowerCase()}. Nobody here is on the platform yet.`}
      />
      <div className="px-4 py-5 md:px-6">
        <ProspectBoard
          prospects={prospects.ok ? prospects.data : []}
          touches={touches.ok ? touches.data : []}
          team={team.ok ? team.data : []}
          defaultMarket={staff.data.market}
          error={prospects.ok ? null : prospects.error}
          touchesError={touches.ok ? null : touches.error}
        />
      </div>
    </>
  )
}
