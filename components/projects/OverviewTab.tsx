'use client'

import { useTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronRight } from 'lucide-react'
import type { WorkspaceProps } from './ProjectWorkspace'
import { Badge, Button, Card, CardHead, Problem, Progress, Stat } from '@/components/ui'
import { STAGES, designProgress, procurementSummary, projectPnl, stageIndex } from '@/lib/domain/project'
import { quoteTotals } from '@/lib/domain/money'
import { updateProject } from '@/lib/data/actions'
import { date, inr, inrShort, pct } from '@/lib/format'
import { cn } from '@/lib/cn'

export function OverviewTab(
  props: WorkspaceProps & { onGo: (tab: 'design' | 'quote' | 'procurement' | 'money') => void },
) {
  const { project, areas, boards, quotes, linesByQuote, procurement, finance, onGo } = props
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const design = designProgress(areas, boards)
  const proc = procurementSummary(procurement)
  const pnl = projectPnl(finance)

  const liveQuote =
    quotes.find((q) => q.status === 'accepted') ?? quotes.find((q) => q.status === 'shared') ?? quotes[0]
  const liveTotals = liveQuote ? quoteTotals(linesByQuote[liveQuote.id] ?? [], liveQuote) : null

  const here = stageIndex(project.stage)

  function moveTo(stage: string) {
    setError(null)
    start(async () => {
      const res = await updateProject(project.id, {
        stage,
        ...(stage === 'closed' ? { closed_on: new Date().toISOString().slice(0, 10) } : {}),
      })
      if (!res.ok) return setError(res.error)
      router.refresh()
    })
  }

  return (
    <div className="space-y-5">
      {error ? <Problem title="Could not move the project" detail={error} /> : null}

      {/* The three stages from the brief, as a stepper you can actually click. */}
      <Card>
        <CardHead title="Where this project is" hint="Click a stage to move it. Nothing is lost by going back." />
        <ol className="grid gap-0 md:grid-cols-4">
          {STAGES.map((s, i) => {
            const done = i < here
            const current = i === here
            return (
              <li key={s.key} className={cn('border-line p-4', i > 0 && 'border-t md:border-t-0 md:border-l')}>
                <button
                  onClick={() => moveTo(s.key)}
                  disabled={pending || current}
                  className="w-full text-left disabled:cursor-default"
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        'flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                        done ? 'bg-good text-white' : current ? 'bg-brand text-white' : 'bg-line text-ink-faint',
                      )}
                    >
                      {done ? <Check size={11} /> : i + 1}
                    </span>
                    <span className={cn('text-sm font-semibold', current ? 'text-brand' : 'text-ink')}>{s.label}</span>
                    {current ? <Badge tone="brand">Now</Badge> : null}
                  </span>
                  <span className="mt-1 block pl-7 text-xs text-ink-faint">{s.blurb}</span>
                </button>
              </li>
            )
          })}
        </ol>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <button onClick={() => onGo('design')} className="text-left">
          <Stat
            label="Design"
            value={design ? `${design.done} / ${design.total}` : '—'}
            hint={design ? `${design.pct}% of rooms signed off` : 'No rooms added yet'}
            tone="brand"
            className="h-full transition hover:border-brand-line"
          />
        </button>
        <button onClick={() => onGo('quote')} className="text-left">
          <Stat
            label={liveQuote ? `Quote v${liveQuote.version}` : 'Quote'}
            value={liveTotals ? inrShort(liveTotals.clientTotal) : '—'}
            hint={
              liveQuote
                ? `${liveQuote.status} · ${liveTotals?.lines ?? 0} lines · your margin ${inrShort(liveTotals?.margin ?? 0)}`
                : 'Not built yet'
            }
            className="h-full transition hover:border-brand-line"
          />
        </button>
        <button onClick={() => onGo('procurement')} className="text-left">
          <Stat
            label="Procured"
            value={proc.items ? pct(proc.pctDelivered) : '—'}
            hint={proc.items ? `${proc.delivered} of ${proc.items} lines delivered · ${inrShort(proc.value)} on the list` : 'Nothing on the list yet'}
            className="h-full transition hover:border-brand-line"
          />
        </button>
        <button onClick={() => onGo('money')} className="text-left">
          <Stat
            label="Your profit"
            value={finance.length ? inr(pnl.profit) : '—'}
            hint={finance.length ? `${inrShort(pnl.income)} in · ${inrShort(pnl.cost)} out · ${pct(pnl.marginPct)} margin` : 'No entries yet'}
            tone={pnl.profit < 0 ? 'bad' : 'good'}
            className="h-full transition hover:border-brand-line"
          />
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHead title="Rooms" hint="Progress on signing off each area" />
          {areas.length === 0 ? (
            <div className="p-4">
              <p className="text-sm text-ink-soft">No rooms yet.</p>
              <Button variant="primary" className="mt-3" onClick={() => onGo('design')}>
                Add the first room <ChevronRight size={14} />
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {areas.map((a) => {
                const mine = boards.filter((b) => b.area_id === a.id)
                const approved = mine.find((b) => b.status === 'approved')
                return (
                  <li key={a.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">{a.name}</span>
                    <span className="text-xs text-ink-faint">
                      {mine.length} option{mine.length === 1 ? '' : 's'}
                    </span>
                    <Badge tone={approved ? 'good' : a.status === 'shortlisted' ? 'warn' : 'neutral'}>
                      {approved ? 'Signed off' : a.status}
                    </Badge>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        <Card>
          <CardHead title="The brief" hint="What you told us when you set this project up" />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 p-4 text-sm">
            <Detail label="Type" value={project.project_type.replace('_', ' ')} />
            <Detail label="Carpet area" value={project.carpet_area_sqft ? `${project.carpet_area_sqft} sqft` : '—'} />
            <Detail label="Client budget" value={project.budget ? inr(project.budget) : '—'} />
            <Detail label="Your design fee" value={project.design_fee ? inr(project.design_fee) : '—'} />
            <Detail label="Started" value={date(project.started_on)} />
            <Detail label="Target handover" value={date(project.target_on)} />
            <Detail label="Site" value={project.site_address ?? project.city ?? '—'} className="col-span-2" />
          </dl>
          {project.budget && liveTotals ? (
            <div className="border-t border-line px-4 py-3">
              <div className="mb-1.5 flex justify-between text-xs">
                <span className="text-ink-soft">Quoted against budget</span>
                <span className={cn('tnum font-medium', liveTotals.clientTotal > project.budget ? 'text-bad' : 'text-good')}>
                  {inrShort(liveTotals.clientTotal)} of {inrShort(project.budget)}
                </span>
              </div>
              <Progress
                pct={(liveTotals.clientTotal / project.budget) * 100}
                tone={liveTotals.clientTotal > project.budget ? 'brand' : 'good'}
              />
              {liveTotals.clientTotal > project.budget ? (
                <p className="mt-1.5 text-[11px] text-bad">
                  Over budget by {inr(liveTotals.clientTotal - project.budget)}.
                </p>
              ) : null}
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  )
}

function Detail({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-[11px] font-medium tracking-wide text-ink-faint uppercase">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink capitalize">{value}</dd>
    </div>
  )
}
