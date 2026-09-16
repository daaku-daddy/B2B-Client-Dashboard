import Link from 'next/link'
import { ArrowRight, Sparkles } from 'lucide-react'
import { Card } from '@/components/ui'

export type Nudge = { id: string; text: string; href: string; cta: string; tone?: 'brand' | 'warn' }

/**
 * §8.2.7's next-best-action strip.
 *
 * "Rule-driven nudges: '₹45,000 more this month unlocks the 3% slab', '3
 * referred clients haven't visited a store in 30 days', '2 portfolio items need
 * changes'."
 *
 * Rule-driven, and the rules live in `nudgesFor()` on the Overview page where
 * the data already is — not in a scoring model, and not in a table somebody has
 * to maintain. Three things keep this from becoming noise:
 *
 * 1. **Every nudge names a number.** "Follow up with your clients" is not a
 *    nudge, it is a poster.
 * 2. **Every nudge goes somewhere.** A prompt with no destination is a chore
 *    handed to the user.
 * 3. **At most three.** Beyond that it stops being a next-best-action strip and
 *    becomes a to-do list, which is the thing §18 calls "scope creep into a
 *    full ERP for design firms".
 */
export function NextBestAction({ nudges }: { nudges: Nudge[] }) {
  if (!nudges.length) return null
  return (
    <Card className="border-brand-line bg-brand-soft">
      <div className="flex items-start gap-3 px-4 py-3">
        <Sparkles size={16} className="mt-0.5 shrink-0 text-brand" />
        <ul className="min-w-0 flex-1 space-y-1.5">
          {nudges.slice(0, 3).map((n) => (
            <li key={n.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <span className="text-sm text-ink">{n.text}</span>
              <Link
                href={n.href}
                className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-brand hover:underline"
              >
                {n.cta} <ArrowRight size={11} />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  )
}
