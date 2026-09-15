import { requireStaff } from '@/lib/data/session'
import { getProspect, listStaff } from '@/lib/data/console-queries'
import { ApplicationForm } from '@/components/console/ApplicationForm'
import { PageHead } from '@/components/shell/PageHead'
import { Problem } from '@/components/ui'

export default async function NewApplicationPage({
  searchParams,
}: {
  searchParams: Promise<{ prospect?: string }>
}) {
  const { prospect: prospectId } = await searchParams
  const [staff, team, prospect] = await Promise.all([
    requireStaff(),
    listStaff(),
    prospectId ? getProspect(prospectId) : Promise.resolve({ ok: true as const, data: null }),
  ])

  if (!staff.ok) {
    return (
      <>
        <PageHead title="Onboard a firm" />
        <div className="px-4 py-5 md:px-6"><Problem title="You cannot open this" detail={staff.error} /></div>
      </>
    )
  }

  return (
    <>
      <PageHead
        title="Onboard a firm"
        crumbs={[{ href: '/console/applications', label: 'Onboarding' }, { label: 'New' }]}
        hint="Fill this in after the meeting. An admin verifies it before any login is created."
      />
      <div className="max-w-4xl px-4 py-5 md:px-6">
        {!prospect.ok ? (
          <div className="mb-4">
            <Problem
              title="That prospect could not be loaded"
              detail={`${prospect.error} — the form below is still usable, it just will not be pre-filled or linked back to them.`}
            />
          </div>
        ) : null}
        <ApplicationForm
          kams={team.ok ? team.data.filter((s) => s.role === 'kam' && s.active) : []}
          defaultMarket={staff.data.market}
          prospect={prospect.ok ? prospect.data : null}
        />
      </div>
    </>
  )
}
