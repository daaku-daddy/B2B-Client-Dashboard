import Link from 'next/link'
import { ArrowRight, Plus } from 'lucide-react'
import { currentSession, myKam } from '@/lib/data/session'
import {
  listActivity, listClients, listProjects, listReferralEvents, listReferralOrders, listReferrals,
  listRewardClaims, listRewardTiers,
} from '@/lib/data/queries'
import { attributedSale, pendingSale, rewardStatus } from '@/lib/domain/rewards'
import { RewardTrack } from '@/components/rewards/RewardTrack'
import { PageHead } from '@/components/shell/PageHead'
import { ReferralFeed } from '@/components/referrals/ReferralFeed'
import { KamCard } from '@/components/partner/KamCard'
import { ActivityFeed } from '@/components/partner/ActivityFeed'
import { Badge, Button, Card, CardHead, Empty, Problem, Stat } from '@/components/ui'
import { inr, inrShort } from '@/lib/format'
import { STAGES } from '@/lib/domain/project'

/**
 * The partner's home.
 *
 * Built around the one question a designer actually has on day one — *what did
 * the clients I sent you do, and what am I owed for it* — and nothing else. The
 * project workspace appears below it only for firms that have asked for it
 * (`partner.workspace_enabled`); for everyone else this page never mentions
 * boards, quotes or margins, because a landing page that opens with six empty
 * modules reads as homework.
 */
export default async function DashboardPage() {
  const session = await currentSession()
  const firstName = session.ok && session.data ? session.data.partner.contact_name.split(' ')[0] : 'there'
  const workspace = session.ok && session.data ? session.data.partner.workspace_enabled : false

  const [referrals, tiers, claims, kam, activity] = await Promise.all([
    listReferrals(), listRewardTiers(), listRewardClaims(), myKam(), listActivity(8),
  ])

  const refIds = referrals.ok ? referrals.data.map((r) => r.id) : []
  const [orders, events, projects, clients] = await Promise.all([
    listReferralOrders(refIds),
    listReferralEvents(refIds, 12),
    workspace ? listProjects() : Promise.resolve({ ok: true as const, data: [] }),
    workspace ? listClients() : Promise.resolve({ ok: true as const, data: [] }),
  ])

  const problems = [referrals, tiers, claims, projects, clients].filter((r) => !r.ok) as { ok: false; error: string }[]

  // Approved only. The pending figure is shown beside it rather than folded in —
  // a partner who sees a total that quietly excludes their newest order, with no
  // explanation, assumes the number is wrong.
  const approved = orders.ok ? attributedSale(orders.data) : 0
  const waiting = orders.ok ? pendingSale(orders.data) : { count: 0, value: 0 }
  const status = rewardStatus(approved, tiers.ok ? tiers.data : [], claims.ok ? claims.data : [])

  const live = projects.ok ? projects.data.filter((p) => p.status === 'active') : []
  const byStage = (s: string) => live.filter((p) => p.stage === s).length

  return (
    <>
      <PageHead
        title={`Good to see you, ${firstName}`}
        hint="What the clients you sent us have been doing, and where that has got you."
        action={
          workspace ? (
            <Link href="/projects?new=1">
              <Button variant="primary"><Plus size={15} /> New project</Button>
            </Link>
          ) : null
        }
      />

      <div className="space-y-5 px-4 py-5 md:px-6">
        {problems.length ? (
          <Problem title="Some of this page could not load" detail={problems.map((p) => p.error).join(' · ')} />
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Clients you sent us"
            value={referrals.ok ? referrals.data.length : '—'}
            hint={`${orders.ok ? orders.data.length : 0} order${orders.ok && orders.data.length === 1 ? '' : 's'} between them`}
          />
          <Stat
            label="Business sent our way"
            value={inrShort(approved)}
            hint="Verified and counting"
            tone="good"
          />
          <Stat
            label="Being checked"
            value={waiting.count ? inrShort(waiting.value) : '—'}
            hint={
              waiting.count
                ? `${waiting.count} order${waiting.count === 1 ? '' : 's'} we are confirming`
                : 'Nothing waiting on us'
            }
            tone={waiting.count ? 'brand' : undefined}
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
                  : 'Tell us about a client and everything they do with us — store visits, carts, orders — shows up here.'
              }
            />
          </Card>

          <div className="space-y-5">
            <KamCard kam={kam.ok ? kam.data : null} error={kam.ok ? null : kam.error} />
            <Card>
              <CardHead title="Your account with us" hint="What we have done, and when" />
              <ActivityFeed items={activity.ok ? activity.data : []} error={activity.ok ? null : activity.error} />
            </Card>
          </div>
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

        {workspace ? (
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
            <p className="border-t border-line px-4 py-2 text-[11px] text-ink-faint">
              {live.length
                ? `${byStage('design')} in design · ${byStage('procurement')} procuring · ${byStage('execution')} on site`
                : null}
            </p>
          </Card>
        ) : (
          <Card>
            <div className="px-4 py-4">
              <h2 className="font-display text-[15px] font-semibold tracking-tight text-ink">
                There is more here if you want it
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-soft">
                Design boards, client quotes with your own markup, a procurement list and a project P&amp;L are
                all built and switched off for your account. They are yours to turn on whenever you want them,
                and nobody at Material Depot can see what you put in them — not your clients, not your rates,
                not your margins. Ask your key account manager and we will enable it.
              </p>
            </div>
          </Card>
        )}
      </div>
    </>
  )
}
