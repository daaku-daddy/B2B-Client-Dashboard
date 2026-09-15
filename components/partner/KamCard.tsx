import { Mail, Phone, UserRound } from 'lucide-react'
import type { MyKam } from '@/lib/domain/types'
import { Card, CardHead, Problem } from '@/components/ui'

/**
 * Who to ring. A partner has no read on `staff_user`, so this comes from the
 * `my_kam()` function — their KAM and nobody else's.
 *
 * "No KAM yet" is a real state (a firm provisioned before anyone was assigned),
 * and it is said plainly rather than hidden: a partner who does not know who
 * their contact is will not go looking, they will just stop using this.
 */
export function KamCard({ kam, error }: { kam: MyKam | null; error?: string | null }) {
  return (
    <Card>
      <CardHead title="Your Material Depot contact" hint="Rates, samples, site queries — start here" />
      <div className="px-4 py-4">
        {error ? (
          <Problem title="We could not look that up" detail={error} />
        ) : !kam ? (
          <p className="text-sm text-ink-soft">
            Nobody is assigned to your account yet. Anyone at a Material Depot store can help in the
            meantime, and we will introduce you to your key account manager shortly.
          </p>
        ) : (
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
              <UserRound size={18} />
            </span>
            <div className="min-w-0">
              <p className="font-display text-[15px] font-semibold text-ink">{kam.name}</p>
              <p className="text-xs text-ink-faint">Key account manager</p>
              <div className="mt-2 flex flex-col gap-1 text-sm">
                {kam.phone ? (
                  <a href={`tel:${kam.phone}`} className="inline-flex items-center gap-1.5 text-brand hover:underline">
                    <Phone size={13} /> {kam.phone}
                  </a>
                ) : null}
                {kam.email ? (
                  <a href={`mailto:${kam.email}`} className="inline-flex items-center gap-1.5 truncate text-brand hover:underline">
                    <Mail size={13} /> {kam.email}
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
