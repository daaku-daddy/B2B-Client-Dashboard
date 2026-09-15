/**
 * The cities the B2B team is organised around.
 *
 * Free text in the database on purpose — `staff_user.market`, `partner.market`,
 * `outreach_prospect.market` and `partner_application.market` have no CHECK
 * constraint, same as `project_area.area_type`. Opening Chennai must be a line
 * in this file and a deploy, not a migration somebody has to remember to paste.
 *
 * A staff member with `market = null` covers every market: that is the admin and
 * the central team. A firm with `market = null` is visible to the whole team
 * rather than to nobody — an unassigned firm nobody can see is a firm nobody
 * follows up. Both rules live in `app_covers_market()` in 003_roles.sql.
 */
export const MARKETS = [
  { key: 'bangalore', label: 'Bangalore' },
  { key: 'hyderabad', label: 'Hyderabad' },
] as const

export type MarketKey = (typeof MARKETS)[number]['key']

export function marketLabel(key: string | null | undefined): string {
  if (!key) return 'All markets'
  return MARKETS.find((m) => m.key === key)?.label ?? key
}

/**
 * Best guess at the market a free-text city belongs to — used once, when a
 * migration backfills firms that signed up before markets existed, and in the
 * onboarding form to pre-select the obvious answer.
 *
 * Returns null rather than a nearest match. An unknown city is an unassigned
 * firm that the whole team can see, which is recoverable; a wrong market puts
 * the firm on a list nobody in that city is working.
 */
export function guessMarket(city: string | null | undefined): MarketKey | null {
  const c = (city ?? '').trim().toLowerCase()
  if (!c) return null
  if (c.startsWith('beng') || c.startsWith('bang')) return 'bangalore'
  if (c.startsWith('hyd') || c.startsWith('secund')) return 'hyderabad'
  return null
}
