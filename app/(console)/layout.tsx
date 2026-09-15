import { redirect } from 'next/navigation'
import { currentActor } from '@/lib/data/session'
import { Sidebar } from '@/components/shell/Sidebar'
import { consoleNav } from '@/components/shell/nav'
import { Problem } from '@/components/ui'
import { marketLabel } from '@/lib/domain/markets'

const ROLE_LABEL = {
  admin: 'Admin',
  kam: 'Key account manager',
  outreach: 'Outreach',
  inbound: 'Inbound',
} as const

/**
 * The Material Depot console.
 *
 * One gate, here, and then RLS everywhere below it. This layout decides only
 * which app you are in; it does not decide what you can read. A KAM who typed
 * `/console/partners` still sees exactly the firms `app_covers_market()` lets
 * them see, and a page that forgot to filter would show them nothing extra.
 */
export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const actor = await currentActor()

  if (!actor.ok) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16">
        <Problem title="The console could not be loaded" detail={actor.error} />
      </main>
    )
  }
  if (!actor.data) redirect('/login')

  // A partner who lands here gets their own app back, not a permission error:
  // there is nothing wrong with them, they are just not staff.
  if (actor.data.kind === 'partner') redirect('/dashboard')

  if (actor.data.kind === 'none') {
    return (
      <main className="mx-auto max-w-xl px-4 py-16">
        <Problem
          title="This login is not attached to anything yet"
          detail={
            <>
              You are signed in as {actor.data.email ?? 'an unknown address'}, but the account belongs to
              neither a partner firm nor the Material Depot team.
              <br />
              <br />
              If you are Material Depot staff, an admin adds you from <strong>Team</strong> in the console.
              The very first admin is linked by hand — the snippet is in{' '}
              <code>supabase/migrations/README.md</code>.
            </>
          }
        />
      </main>
    )
  }

  const { staff, email } = actor.data
  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <Sidebar
        items={consoleNav(staff.role)}
        eyebrow="B2B Console"
        tone="ink"
        footerTitle={`${staff.name} · ${ROLE_LABEL[staff.role]}`}
        footerSub={`${marketLabel(staff.market)} · ${email ?? ''}`}
      />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
