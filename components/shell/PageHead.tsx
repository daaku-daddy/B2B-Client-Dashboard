import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export function PageHead({
  title,
  hint,
  crumbs,
  action,
}: {
  title: React.ReactNode
  hint?: React.ReactNode
  crumbs?: { href?: string; label: string }[]
  action?: React.ReactNode
}) {
  return (
    <header className="border-b border-line bg-surface px-4 py-4 md:px-6 md:py-5">
      {crumbs?.length ? (
        <nav className="mb-1.5 flex items-center gap-1 text-[11px] text-ink-faint">
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 ? <ChevronRight size={11} /> : null}
              {c.href ? (
                <Link href={c.href} className="transition hover:text-brand">{c.label}</Link>
              ) : (
                <span>{c.label}</span>
              )}
            </span>
          ))}
        </nav>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-xl leading-tight font-semibold tracking-tight text-ink md:text-2xl">
            {title}
          </h1>
          {hint ? <p className="mt-1 max-w-2xl text-sm text-ink-soft">{hint}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </header>
  )
}
