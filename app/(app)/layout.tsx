import { redirect } from 'next/navigation'
import { currentSession } from '@/lib/data/session'
import { Sidebar } from '@/components/shell/Sidebar'
import { Onboarding } from '@/components/shell/Onboarding'
import { Problem } from '@/components/ui'
import { supabaseServer } from '@/lib/supabase/server'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await currentSession()

  // A failed read is NOT treated as "no firm". Offering the sign-up form here
  // would let a partner create a second firm over the top of their real one.
  if (!session.ok) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16">
        <Problem
          title="We could not load your workspace"
          detail={
            <>
              {session.error}
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

  if (!session.data) {
    const sb = await supabaseServer()
    const { data } = await sb.auth.getUser()
    if (!data.user) redirect('/login')
    return <Onboarding email={data.user.email ?? null} />
  }

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <Sidebar partner={session.data.partner} email={session.data.email} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
