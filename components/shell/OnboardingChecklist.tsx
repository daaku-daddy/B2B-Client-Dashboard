import Link from 'next/link'
import { Check, Circle } from 'lucide-react'
import { Card, CardHead } from '@/components/ui'

/**
 * §8.2.8 — "A newly provisioned partner sees a three-step onboarding checklist
 * — complete company profile, refer your first client, create your first
 * project — instead of zeroed cards."
 *
 * The reason the PRD specifies this rather than leaving it to taste: a dashboard
 * whose first impression is six cards reading ₹0 tells a new partner that the
 * thing is empty and they were right to be sceptical. Three steps with one done
 * already tells them it is a thing you fill in.
 */
export function OnboardingChecklist({
  steps,
}: {
  steps: { label: string; done: boolean; href: string; why: string }[]
}) {
  const done = steps.filter((s) => s.done).length
  return (
    <Card>
      <CardHead
        title="Getting set up"
        hint={`${done} of ${steps.length} done. This takes about five minutes and it is the whole setup.`}
      />
      <ul className="divide-y divide-line">
        {steps.map((s) => (
          <li key={s.label}>
            <Link
              href={s.href}
              className="flex items-start gap-3 px-4 py-3 transition hover:bg-raised"
              aria-disabled={s.done}
            >
              <span className={`mt-0.5 shrink-0 ${s.done ? 'text-good' : 'text-ink-faint'}`}>
                {s.done ? <Check size={16} /> : <Circle size={16} />}
              </span>
              <span className="min-w-0">
                <span className={`block text-sm font-medium ${s.done ? 'text-ink-faint line-through' : 'text-ink'}`}>
                  {s.label}
                </span>
                <span className="block text-xs text-ink-faint">{s.why}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  )
}
