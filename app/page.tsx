import { redirect } from 'next/navigation'
import { currentActor } from '@/lib/data/session'

/**
 * The front door. Three kinds of people arrive here and each belongs somewhere
 * different — sending everyone to /dashboard would drop a KAM into an empty
 * partner workspace and leave them thinking the app was broken.
 */
export default async function Root() {
  const actor = await currentActor()
  if (!actor.ok || !actor.data) redirect('/login')
  redirect(actor.data.kind === 'staff' ? '/console' : '/dashboard')
}
