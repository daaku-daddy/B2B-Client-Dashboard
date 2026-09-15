import { requireStaff } from '@/lib/data/session'
import { listStaff } from '@/lib/data/console-queries'
import { StaffTable } from '@/components/console/StaffTable'
import { PageHead } from '@/components/shell/PageHead'
import { Problem } from '@/components/ui'

export default async function StaffPage() {
  const [staff, team] = await Promise.all([requireStaff(['admin']), listStaff()])

  if (!staff.ok) {
    return (
      <>
        <PageHead title="Team" />
        <div className="px-4 py-5 md:px-6">
          <Problem
            title="Admins only"
            detail={`${staff.error} Adding somebody to the team creates a login, so it sits with the same people who verify orders.`}
          />
        </div>
      </>
    )
  }

  return (
    <>
      <PageHead
        title="Team"
        hint="Who does what, and which market they work. This is what decides whose firms and whose prospect list each person can see."
      />
      <div className="px-4 py-5 md:px-6">
        <StaffTable
          team={team.ok ? team.data : []}
          meId={staff.data.user_id}
          error={team.ok ? null : team.error}
        />
      </div>
    </>
  )
}
