'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Eye, Search } from 'lucide-react'
import { Badge, Card, CardHead, Empty, Input, Problem, Select, Stat, Table, Td, Th } from '@/components/ui'
import { EngagementBadge, TierBadge } from './Standing'
import type { PartnerStanding } from '@/lib/domain/tiering'
import { DORMANT_AFTER_DAYS, USAGE_TIER } from '@/lib/domain/tiering'
import type { Partner, StaffUser } from '@/lib/domain/types'
import { MARKETS, marketLabel } from '@/lib/domain/markets'
import { date, inrShort } from '@/lib/format'

export type PartnerRow = { partner: Partner; standing: PartnerStanding }

/**
 * Every firm the signed-in staff member can see, with the internal read on each.
 *
 * The two filters that matter are on the top row and not buried: **needs a call**
 * is the reactivation list — a firm that used to order and has not for
 * three months — and **Power** is where the revenue is. Everything else is
 * secondary.
 *
 * The classification is internal. Nothing on this screen is shown to a partner,
 * and nothing here renders inside the partner app.
 */
export function PartnerDirectory({ rows, team, error }: { rows: PartnerRow[]; team: StaffUser[]; error?: string | null }) {
  const [q, setQ] = useState('')
  const [market, setMarket] = useState('all')
  const [view, setView] = useState<'all' | 'dormant' | 'power' | 'no_kam' | 'never'>('all')

  const kamName = (id: string | null) => team.find((s) => s.user_id === id)?.name ?? null

  const totals = useMemo(() => {
    const t = { power: 0, mid: 0, basic: 0, dormant: 0, never: 0, noKam: 0, pending: 0 }
    for (const r of rows) {
      t[r.standing.tier] += 1
      if (r.standing.engagement === 'dormant') t.dormant += 1
      if (r.standing.engagement === 'never_ordered') t.never += 1
      if (!r.partner.kam_user_id) t.noKam += 1
      t.pending += r.standing.pendingCount
    }
    return t
  }, [rows])

  const shown = rows.filter(({ partner, standing }) => {
    if (market !== 'all' && partner.market !== market) return false
    if (view === 'dormant' && standing.engagement !== 'dormant') return false
    if (view === 'never' && standing.engagement !== 'never_ordered') return false
    if (view === 'power' && standing.tier !== 'power') return false
    if (view === 'no_kam' && partner.kam_user_id) return false
    const needle = q.trim().toLowerCase()
    if (!needle) return true
    return [partner.firm_name, partner.contact_name, partner.phone, partner.city, partner.email]
      .some((v) => v?.toLowerCase().includes(needle))
  })

  return (
    <>
      {error ? <div className="mb-4"><Problem title="The directory did not load" detail={error} /></div> : null}

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Firms" value={rows.length} hint={`${totals.noKam} without a KAM`} tone="brand" />
        <Stat
          label="Needs a call"
          value={totals.dormant}
          hint={`No verified order in ${DORMANT_AFTER_DAYS} days`}
          tone={totals.dormant ? 'bad' : 'good'}
        />
        <Stat
          label="Power firms"
          value={totals.power}
          hint={`${totals.mid} mid · ${totals.basic} basic`}
          tone="good"
        />
        <Stat
          label="Orders waiting on an admin"
          value={totals.pending}
          hint={totals.pending ? 'Not counting towards anyone’s rewards yet' : 'Nothing outstanding'}
        />
      </div>

      <Card>
        <CardHead
          title="Firms on the platform"
          hint="The classification here is internal — it decides where a KAM spends their week and is never shown to a partner."
        />

        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
          <div className="relative min-w-[200px] flex-1">
            <Search size={14} className="absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-faint" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search firm, contact, phone…" className="pl-8" />
          </div>
          <Select value={market} onChange={(e) => setMarket(e.target.value)} className="w-auto">
            <option value="all">Every market</option>
            {MARKETS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
          </Select>
          <Select value={view} onChange={(e) => setView(e.target.value as typeof view)} className="w-auto">
            <option value="all">Everyone</option>
            <option value="dormant">Needs a call ({totals.dormant})</option>
            <option value="never">Never ordered ({totals.never})</option>
            <option value="power">Power firms ({totals.power})</option>
            <option value="no_kam">No KAM ({totals.noKam})</option>
          </Select>
        </div>

        {rows.length === 0 ? (
          <Empty
            title="No firms in your scope yet"
            body="Firms appear here once an admin has issued their login from an onboarding form."
          />
        ) : shown.length === 0 ? (
          <Empty title="Nothing matches that" body="Try a different filter." />
        ) : (
          <Table className="min-w-[940px]">
            <thead>
              <tr>
                <Th>Firm</Th><Th>Market</Th><Th>KAM</Th><Th>Class</Th><Th>Standing</Th>
                <Th className="text-right">Orders</Th><Th className="text-right">Verified</Th><Th>Last order</Th>
                <Th><span className="sr-only">Their dashboard</span></Th>
              </tr>
            </thead>
            <tbody>
              {shown.map(({ partner, standing }) => (
                <tr key={partner.id} className="transition hover:bg-raised">
                  <Td>
                    <Link href={`/console/partners/${partner.id}`} className="font-medium text-ink hover:text-brand">
                      {partner.firm_name}
                    </Link>
                    <p className="text-[11px] text-ink-faint">
                      {partner.contact_name} · <span className="tnum">{partner.phone}</span>
                      {partner.workspace_enabled ? ' · workspace on' : ''}
                    </p>
                  </Td>
                  <Td className="text-xs text-ink-soft">{marketLabel(partner.market)}</Td>
                  <Td className="text-xs text-ink-soft">
                    {kamName(partner.kam_user_id) ?? <span className="text-warn">Nobody</span>}
                  </Td>
                  <Td><TierBadge standing={standing} /></Td>
                  <Td>
                    <EngagementBadge standing={standing} />
                    {standing.pendingCount ? (
                      <Badge tone="warn" className="ml-1">{standing.pendingCount} to verify</Badge>
                    ) : null}
                  </Td>
                  <Td className="tnum text-right text-xs">{standing.orderCount}</Td>
                  <Td className="tnum text-right text-xs font-medium text-good">
                    {standing.approvedValue ? inrShort(standing.approvedValue) : '—'}
                  </Td>
                  <Td className="text-xs text-ink-soft">
                    {standing.lastOrderOn ? date(standing.lastOrderOn) : '—'}
                  </Td>
                  <Td>
                    <Link
                      href={`/console/partners/${partner.id}/dashboard`}
                      title={`Open ${partner.firm_name}'s own dashboard, read-only`}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-ink-faint transition hover:text-brand"
                    >
                      <Eye size={12} /> Their view
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}

        <p className="border-t border-line px-4 py-2 text-[11px] leading-relaxed text-ink-faint">
          <strong>Class</strong> counts VERIFIED orders: {USAGE_TIER.power.blurb} is Power,{' '}
          {USAGE_TIER.mid.blurb} is Mid, {USAGE_TIER.basic.blurb} is Basic. Both it and the standing are
          worked out from the orders every time this page loads — neither is stored, so neither can go
          stale against the list above.
        </p>
      </Card>
    </>
  )
}
