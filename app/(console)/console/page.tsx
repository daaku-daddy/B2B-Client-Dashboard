import Link from 'next/link'
import { ArrowRight, CalendarClock, KeyRound, PhoneCall, ShieldCheck } from 'lucide-react'
import { requireStaff } from '@/lib/data/session'
import {
  listAllOrders, listApplications, listPartners, listPortfolioQueue, listProspects, listStaff,
} from '@/lib/data/console-queries'
import { partnerStanding } from '@/lib/domain/tiering'
import { EngagementBadge, TierBadge } from '@/components/console/Standing'
import { PageHead } from '@/components/shell/PageHead'
import { Badge, Card, CardHead, Empty, Problem, Stat } from '@/components/ui'
import { marketLabel } from '@/lib/domain/markets'
import { date, inr, inrShort } from '@/lib/format'
import type { ReferralOrder } from '@/lib/domain/types'

/**
 * What is waiting on the person signed in.
 *
 * Deliberately not a metrics dashboard. Every card here is a queue with a name
 * and a link, because the question a KAM or an admin opens this with is "what do
 * I have to do today", and a screen of totals answers a different one.
 *
 * The cards a role cannot act on are not rendered for them — an outreach manager
 * has no use for the order verification queue.
 */
export default async function ConsoleHome() {
  const staff = await requireStaff()
  if (!staff.ok) {
    return (
      <>
        <PageHead title="Console" />
        <div className="px-4 py-5 md:px-6"><Problem title="You cannot open this" detail={staff.error} /></div>
      </>
    )
  }

  const me = staff.data
  const isAdmin = me.role === 'admin'
  const worksProspects = me.role === 'outreach' || me.role === 'inbound' || isAdmin
  const worksFirms = me.role === 'kam' || isAdmin

  const [partners, orders, applications, prospects, portfolio, team] = await Promise.all([
    worksFirms ? listPartners() : Promise.resolve({ ok: true as const, data: [] }),
    worksFirms || isAdmin ? listAllOrders(1000) : Promise.resolve({ ok: true as const, data: [] }),
    listApplications(),
    worksProspects ? listProspects() : Promise.resolve({ ok: true as const, data: [] }),
    isAdmin ? listPortfolioQueue() : Promise.resolve({ ok: true as const, data: [] }),
    listStaff(),
  ])

  const problems = [partners, orders, applications, prospects, portfolio, team]
    .filter((r) => !r.ok) as { ok: false; error: string }[]

  const byPartner = new Map<string, ReferralOrder[]>()
  if (orders.ok) {
    for (const o of orders.data) {
      const pid = o.referral?.partner_id
      if (!pid) continue
      const list = byPartner.get(pid) ?? []
      list.push(o)
      byPartner.set(pid, list)
    }
  }

  const standings = partners.ok
    ? partners.data.map((p) => ({ partner: p, standing: partnerStanding(byPartner.get(p.id) ?? []) }))
    : []

  const dormant = standings
    .filter((s) => s.standing.engagement === 'dormant')
    .sort((a, b) => (b.standing.daysSinceOrder ?? 0) - (a.standing.daysSinceOrder ?? 0))
  const neverOrdered = standings.filter((s) => s.standing.engagement === 'never_ordered')

  const pendingOrders = orders.ok ? orders.data.filter((o) => o.approval_status === 'pending') : []
  const pendingValue = pendingOrders.reduce((s, o) => s + (Number(o.order_value) || 0), 0)
  const waitingForms = applications.ok ? applications.data.filter((a) => a.status === 'submitted') : []
  const verifiedForms = applications.ok ? applications.data.filter((a) => a.status === 'approved') : []
  const waitingWork = portfolio.ok ? portfolio.data.filter((p) => p.status === 'submitted') : []

  const dueFollowUps = prospects.ok
    ? prospects.data.filter(
        (p) =>
          p.next_action_on &&
          p.stage !== 'not_interested' &&
          p.stage !== 'onboarded' &&
          new Date(p.next_action_on) <= new Date(),
      )
    : []

  const first = me.name.split(' ')[0]

  return (
    <>
      <PageHead
        title={`Morning, ${first}`}
        hint={`${me.role === 'kam' ? 'Key account manager' : me.role === 'admin' ? 'Admin' : me.role === 'outreach' ? 'Outreach' : 'Inbound'} · ${marketLabel(me.market)}`}
      />

      <div className="space-y-5 px-4 py-5 md:px-6">
        {problems.length ? (
          <Problem
            title="Some of this page could not load"
            detail={`${problems.map((p) => p.error).join(' · ')} — the counts below are therefore incomplete, not zero.`}
          />
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {isAdmin ? (
            <Stat
              label="Orders to verify"
              value={pendingOrders.length}
              hint={pendingOrders.length ? `${inrShort(pendingValue)} not counting yet` : 'Nothing outstanding'}
              tone={pendingOrders.length ? 'bad' : 'good'}
            />
          ) : null}
          <Stat
            label="Forms waiting"
            value={waitingForms.length}
            hint={verifiedForms.length ? `${verifiedForms.length} verified, awaiting a login` : 'Nothing waiting on an admin'}
            tone={waitingForms.length ? 'brand' : undefined}
          />
          {worksFirms ? (
            <Stat
              label="Firms to call"
              value={dormant.length}
              hint={neverOrdered.length ? `${neverOrdered.length} have never ordered` : 'Everyone is active'}
              tone={dormant.length ? 'bad' : 'good'}
            />
          ) : null}
          {worksProspects ? (
            <Stat
              label="Follow-ups due"
              value={dueFollowUps.length}
              hint={prospects.ok ? `${prospects.data.length} firms on your list` : '—'}
              tone={dueFollowUps.length ? 'brand' : undefined}
            />
          ) : null}
          {isAdmin ? (
            <Stat label="Work to publish" value={waitingWork.length} hint="Partner projects for the site" />
          ) : null}
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          {isAdmin ? (
            <Card>
              <CardHead
                title="Orders waiting on you"
                hint="Nothing counts towards a partner's rewards until you verify it"
                action={<Queue href="/console/approvals" label="Verify" />}
              />
              {pendingOrders.length === 0 ? (
                <Empty title="All clear" body="Every referred order has been looked at." />
              ) : (
                <ul className="divide-y divide-line">
                  {pendingOrders.slice(0, 6).map((o) => (
                    <li key={o.id} className="flex items-center gap-3 px-4 py-2.5">
                      <ShieldCheck size={15} className="shrink-0 text-warn" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-ink">
                          {o.referral?.client_name ?? 'A client'}
                          <span className="text-ink-soft"> — {o.referral?.partner?.firm_name ?? 'unknown firm'}</span>
                        </p>
                        <p className="truncate text-[11px] text-ink-faint">
                          <span className="font-mono">{o.md_enq_id}</span> · {date(o.ordered_on)}
                        </p>
                      </div>
                      <span className="tnum shrink-0 text-sm font-semibold text-ink">{inr(o.order_value)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ) : null}

          <Card>
            <CardHead
              title="Onboarding"
              hint={isAdmin ? 'Forms to verify, and firms verified but without a login yet' : 'What you have filed'}
              action={<Queue href="/console/applications" label="Open" />}
            />
            {waitingForms.length === 0 && verifiedForms.length === 0 ? (
              <Empty title="Nothing in the queue" body="Every onboarding form has been settled." />
            ) : (
              <ul className="divide-y divide-line">
                {[...verifiedForms, ...waitingForms].slice(0, 6).map((a) => (
                  <li key={a.id} className="flex items-center gap-3 px-4 py-2.5">
                    <KeyRound
                      size={15}
                      className={`shrink-0 ${a.status === 'approved' ? 'text-good' : 'text-warn'}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{a.firm_name}</p>
                      <p className="truncate text-[11px] text-ink-faint">
                        {a.contact_name} · {marketLabel(a.market)} · filed {date(a.created_at)}
                      </p>
                    </div>
                    <Badge tone={a.status === 'approved' ? 'good' : 'warn'}>
                      {a.status === 'approved' ? 'Needs a login' : 'Needs verifying'}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {worksFirms ? (
            <Card>
              <CardHead
                title="Firms that have gone quiet"
                hint="No verified order in three months. Longest first."
                action={<Queue href="/console/partners" label="All firms" />}
              />
              {dormant.length === 0 ? (
                <Empty
                  title="Nobody has gone quiet"
                  body={neverOrdered.length
                    ? `${neverOrdered.length} firm${neverOrdered.length === 1 ? ' has' : 's have'} never ordered though — that is an onboarding that has not landed, not a reactivation.`
                    : 'Every firm has ordered recently.'}
                />
              ) : (
                <ul className="divide-y divide-line">
                  {dormant.slice(0, 7).map(({ partner, standing }) => (
                    <li key={partner.id} className="flex items-center gap-3 px-4 py-2.5">
                      <PhoneCall size={15} className="shrink-0 text-warn" />
                      <div className="min-w-0 flex-1">
                        <Link href={`/console/partners/${partner.id}`} className="truncate text-sm font-medium text-ink hover:text-brand">
                          {partner.firm_name}
                        </Link>
                        <p className="truncate text-[11px] text-ink-faint">
                          {standing.daysSinceOrder} days since their last order ·{' '}
                          {inrShort(standing.approvedValue)} lifetime · {marketLabel(partner.market)}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <TierBadge standing={standing} />
                        <EngagementBadge standing={standing} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ) : null}

          {worksProspects ? (
            <Card>
              <CardHead
                title="Follow-ups due"
                hint="Firms you said you would come back to"
                action={<Queue href="/console/prospects" label="My list" />}
              />
              {dueFollowUps.length === 0 ? (
                <Empty title="Nothing due" body="Nobody on your list is waiting on you today." />
              ) : (
                <ul className="divide-y divide-line">
                  {dueFollowUps.slice(0, 7).map((p) => (
                    <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                      <CalendarClock size={15} className="shrink-0 text-warn" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">{p.firm_name}</p>
                        <p className="truncate text-[11px] text-ink-faint">
                          {p.contact_name ?? 'no contact name'}
                          {p.phone ? ` · ${p.phone}` : ''} · due {date(p.next_action_on)}
                        </p>
                      </div>
                      <Badge tone="warn">{p.stage.replace('_', ' ')}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ) : null}

          {isAdmin && waitingWork.length ? (
            <Card>
              <CardHead
                title="Work waiting to go on the site"
                hint="Submitted by partners for materialdepot.com"
                action={<Queue href="/console/approvals" label="Review" />}
              />
              <ul className="divide-y divide-line">
                {waitingWork.slice(0, 6).map((p) => (
                  <li key={p.id} className="px-4 py-2.5">
                    <p className="truncate text-sm font-medium text-ink">{p.title}</p>
                    <p className="truncate text-[11px] text-ink-faint">
                      {p.partner?.firm_name ?? '—'} · submitted {date(p.submitted_at)}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  )
}

function Queue({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">
      {label} <ArrowRight size={12} />
    </Link>
  )
}
