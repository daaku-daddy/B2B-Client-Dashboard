import { requireStaff } from '@/lib/data/session'
import { listApplications, listStaff } from '@/lib/data/console-queries'
import { ApplicationQueue } from '@/components/console/ApplicationQueue'
import { PageHead } from '@/components/shell/PageHead'
import { Problem } from '@/components/ui'

export default async function ApplicationsPage() {
  const [staff, applications, team] = await Promise.all([
    requireStaff(), listApplications(), listStaff(),
  ])

  if (!staff.ok) {
    return (
      <>
        <PageHead title="Onboarding" />
        <div className="px-4 py-5 md:px-6"><Problem title="You cannot open this" detail={staff.error} /></div>
      </>
    )
  }

  return (
    <>
      <PageHead
        title="Onboarding"
        hint="A firm is met, a form is filed, an admin verifies it, and only then is a login created for you to send."
      />
      <div className="px-4 py-5 md:px-6">
        <ApplicationQueue
          applications={applications.ok ? applications.data : []}
          team={team.ok ? team.data : []}
          isAdmin={staff.data.role === 'admin'}
          error={applications.ok ? null : applications.error}
        />
      </div>
    </>
  )
}
