import Link from 'next/link'
import { ArrowRight, Plus } from 'lucide-react'
import { currentSession } from '@/lib/data/session'
import {
  listClients, listProjects, listReferralEvents, listReferralOrders, listReferrals,
  listRewardClaims, listRewardTiers,
} from '@/lib/data/queries'
import { rewardStatus } from '@/lib/domain/rewards'
import { RewardTrack } from '@/components/rewards/RewardTrack'
import { PageHead } from '@/components/shell/PageHead'
import { ReferralFeed } from '@/components/referrals/ReferralFeed'
import { Badge, Button, Card, CardHead, Empty, Problem, Stat } from '@/components/ui'
import { inr, inrShort } from '@/lib/format'
import { STAGES } from '@/lib/domain/project'

export default async function DashboardPage() {
  const session = await currentSession()
  const firstName = session.ok && session.data ? session.data.partner.contact_name.split(' ')[0] : 'there'

  const [projects, clients, referrals, tiers, claims] = await Promise.all([
    listProjects(), listClients(), listReferrals(), listRewardTiers(), listRewardClaims(),
  ])

  const problems = [projects, clients, referrals, tiers, claims].filter((r) => !r.ok) as { ok: false; error: string }[]

  const refIds = referrals.ok ? referrals.data.map((r) => r.id) : []
  const [orders, events] = await Promise.all([listReferralOrders(refIds), listReferralEvents(refIds, 12)])

  const attributed = orders.ok ? orders.data.reduce((s, o) => s + Number(o.order_value || 0), 0) : 0
  const status = rewardStatus(attributed, tiers.ok ? tiers.data : [], claims.ok ? claims.data : [])

  const live = projects.ok ? projects.data.filter((p) => p.status === 'active') : []
  const byStage = (s: string) => live.filter((p) => p.stage === s).length

  return (
    <>
      <PageHead
        title={`Good to see you, ${firstName}`}
        hint="Your projects, your clients, and what they have been buying from us."
        action={
          <Link href="/projects?new=1">
            <Button variant="primary"><Plus size={15} /> New project</Button>
          </Link>
        }
      />

      <div className="space-y-5 px-4 py-5 md:px-6">
        {problems.length ? (
          <Problem
            title="Some of this page could not load"
            detail={problems.map((p) => p.error).join(' · ')}
          />
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Active projects"
            value={live.length}
            hint={
              live.length
                ? `${byStage('design')} in design · ${byStage('procurement')} procuring · ${byStage('execution')} on site`
                : 'Nothing on the board yet'
            }
            tone="brand"
          />
          <Stat label="Clients" value={clients.ok ? clients.data.length : '—'} hint="On your books" />
          <Stat
            label="Sent to Material Depot"
            value={inrShort(attributed)}
            hint={`${orders.ok ? orders.data.length : 0} order${orders.ok && orders.data.length === 1 ? '' : 's'} from ${refIds.length} referred client${refIds.length === 1 ? '' : 's'}`}
            tone="good"
          />
          <Stat
            label="Next reward needs"
            value={status.next ? inr(status.next.remaining) : 'All earned'}
            hint={status.next ? status.next.tier.label : 'Every milestone unlocked'}
          />
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
          <Card>
            <CardHead
              title="Projects on the board"
              hint="Where each one has got to"
              action={
                <Link href="/projects" className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">
                  All projects <ArrowRight size={12} />
                </Link>
              }
            />
            {!projects.ok ? (
              <div className="p-4"><Problem title="Projects did not load" detail={projects.error} /></div>
            ) : live.length === 0 ? (
              <Empty
                title="No active projects yet"
                body="Add your first client, then a project. Rooms, inspiration boards and the quote all hang off it."
                action={<Link href="/projects?new=1"><Button variant="primary"><Plus size={15} /> New project</Button></Link>}
              />
            ) : (
              <ul className="divide-y divide-line">
                {live.slice(0, 7).map((p) => {
                  const stage = STAGES.find((s) => s.key === p.stage)
                  return (
                    <li key={p.id}>
                      <Link href={`/projects/${p.id}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-raised">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-ink">{p.name}</p>
                          <p className="truncate text-xs text-ink-faint">
                            {p.city ?? p.site_address ?? 'No site address'}
                            {p.budget ? ` · budget ${inrShort(p.budget)}` : ''}
                          </p>
                        </div>
                        <Badge tone={p.stage === 'design' ? 'info' : p.stage === 'procurement' ? 'warn' : 'good'}>
                          {stage?.label ?? p.stage}
                        </Badge>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>

          <Card>
            <CardHead
              title="Your referred clients"
              hint="What they did at Material Depot"
              action={
                <Link href="/referrals" className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">
                  All activity <ArrowRight size={12} />
                </Link>
              }
            />
            <ReferralFeed
              events={events.ok ? events.data : []}
              names={referrals.ok ? new Map(referrals.data.map((r) => [r.id, r.client_name])) : new Map()}
              error={events.ok ? null : events.error}
              emptyBody={
                refIds.length
                  ? 'Nothing has come through for your referred clients yet. Visits, carts and orders appear here as they happen.'
                  : 'Refer a client and everything they do with us — store visits, carts, orders — shows up here.'
              }
            />
          </Card>
        </div>

        <Card className="border-0 bg-transparent">
          <div className="mb-3 flex items-end justify-between">
            <div>
              <h2 className="font-display text-[15px] font-semibold tracking-tight text-ink">Your rewards ladder</h2>
              <p className="text-xs text-ink-faint">Cumulative, across every client you have sent us</p>
            </div>
            <Link href="/rewards" className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">
              Details <ArrowRight size={12} />
            </Link>
          </div>
          <RewardTrack status={status} compact />
        </Card>
      </div>
    </>
  )
}
