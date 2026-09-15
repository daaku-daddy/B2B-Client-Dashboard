import { redirect } from 'next/navigation'
import { currentActor } from '@/lib/data/session'
import { Sidebar } from '@/components/shell/Sidebar'
import { Onboarding } from '@/components/shell/Onboarding'
import { partnerNav } from '@/components/shell/nav'
import { Problem } from '@/components/ui'

/**
 * The partner app. Everything under here belongs to one architecture or design
 * firm, and nobody from Material Depot can read any of it.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const actor = await currentActor()

  // A failed read is NOT treated as "no firm". Offering the sign-up form here
  // would let a partner create a second firm over the top of their real one.
  if (!actor.ok) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16">
        <Problem
          title="We could not load your workspace"
          detail={
            <>
              {actor.error}
              <br />
              <br />
              Nothing has been lost. If this persists, it usually means the database schema has not been
              applied yet — see <code>supabase/migrations/README.md</code>.
            </>
          }
        />
      </main>
    )
  }

  if (!actor.data) redirect('/login')

  // Material Depot's own people get the console, never this. A staff member
  // landing on a partner page would see an empty workspace and read it as the
  // app being broken.
  if (actor.data.kind === 'staff') redirect('/console')

  if (actor.data.kind === 'none') return <Onboarding email={actor.data.email} />

  const { partner, email } = actor.data
  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <Sidebar
        items={partnerNav(partner)}
        eyebrow="for Partners"
        footerTitle={partner.firm_name}
        footerSub={email ?? partner.phone}
      />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
