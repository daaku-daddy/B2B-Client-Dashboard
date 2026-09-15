import { supabaseServer } from '@/lib/supabase/server'
import { fail, ok, type Result } from './result'
import type {
  Board, BoardItem, Client, FinanceEntry, ProcurementItem, Project, ProjectArea,
  Quote, QuoteLine, Referral, ReferralEvent, ReferralOrder, RewardClaim, RewardTier,
  PortfolioItem, PartnerActivity,
} from '@/lib/domain/types'

/**
 * Server-side reads. Everything is scoped by RLS, so none of these filter on
 * partner_id themselves — a query that returns another firm's row is a policy
 * bug, and adding a belt-and-braces filter here would hide it.
 */

async function many<T>(build: (sb: Awaited<ReturnType<typeof supabaseServer>>) => unknown, what: string): Promise<Result<T[]>> {
  const sb = await supabaseServer()
  const { data, error } = (await build(sb)) as { data: T[] | null; error: { message: string } | null }
  if (error) return fail(`Could not load ${what}: ${error.message}`)
  return ok(data ?? [])
}

async function one<T>(build: (sb: Awaited<ReturnType<typeof supabaseServer>>) => unknown, what: string): Promise<Result<T | null>> {
  const sb = await supabaseServer()
  const { data, error } = (await build(sb)) as { data: T | null; error: { message: string } | null }
  if (error) return fail(`Could not load ${what}: ${error.message}`)
  return ok(data ?? null)
}

// ----------------------------------------------------------------- clients

export const listClients = () =>
  many<Client>((sb) => sb.from('client').select('*').order('created_at', { ascending: false }), 'clients')

export const getClient = (id: string) =>
  one<Client>((sb) => sb.from('client').select('*').eq('id', id).maybeSingle(), 'this client')

// ---------------------------------------------------------------- projects

export const listProjects = () =>
  many<Project>((sb) => sb.from('project').select('*').order('updated_at', { ascending: false }), 'projects')

export const getProject = (id: string) =>
  one<Project>((sb) => sb.from('project').select('*').eq('id', id).maybeSingle(), 'this project')

export const listAreas = (projectId: string) =>
  many<ProjectArea>(
    (sb) => sb.from('project_area').select('*').eq('project_id', projectId).order('sort_order').order('created_at'),
    'the rooms on this project',
  )

export const getArea = (id: string) =>
  one<ProjectArea>((sb) => sb.from('project_area').select('*').eq('id', id).maybeSingle(), 'this room')

// ------------------------------------------------------------------ boards

export const listBoards = (areaIds: string[]) =>
  areaIds.length
    ? many<Board>((sb) => sb.from('board').select('*').in('area_id', areaIds).order('created_at'), 'design boards')
    : Promise.resolve(ok<Board[]>([]))

export const listBoardsForArea = (areaId: string) =>
  many<Board>((sb) => sb.from('board').select('*').eq('area_id', areaId).order('created_at'), 'design boards')

export const listBoardItems = (boardIds: string[]) =>
  boardIds.length
    ? many<BoardItem>(
        (sb) => sb.from('board_item').select('*').in('board_id', boardIds).order('sort_order').order('created_at'),
        'the products on this board',
      )
    : Promise.resolve(ok<BoardItem[]>([]))

// ------------------------------------------------------------------ quotes

export const listQuotes = (projectId: string) =>
  many<Quote>(
    (sb) => sb.from('quote').select('*').eq('project_id', projectId).order('version', { ascending: false }),
    'quotes',
  )

export const getQuote = (id: string) =>
  one<Quote>((sb) => sb.from('quote').select('*').eq('id', id).maybeSingle(), 'this quote')

export const listQuoteLines = (quoteId: string) =>
  many<QuoteLine>(
    (sb) => sb.from('quote_line').select('*').eq('quote_id', quoteId).order('sort_order').order('created_at'),
    'the lines on this quote',
  )

// ------------------------------------------------------------- procurement

export const listProcurement = (projectId: string) =>
  many<ProcurementItem>(
    (sb) => sb.from('procurement_item').select('*').eq('project_id', projectId).order('created_at'),
    'the procurement list',
  )

// ----------------------------------------------------------------- finance

export const listFinance = (projectId: string) =>
  many<FinanceEntry>(
    (sb) => sb.from('finance_entry').select('*').eq('project_id', projectId).order('entry_date', { ascending: false }),
    'the project ledger',
  )

// --------------------------------------------------------------- referrals

export const listReferrals = () =>
  many<Referral>((sb) => sb.from('referral').select('*').order('referred_on', { ascending: false }), 'referrals')

export const listReferralEvents = (referralIds: string[], limit = 400) =>
  referralIds.length
    ? many<ReferralEvent>(
        (sb) =>
          sb
            .from('referral_event')
            .select('*')
            .in('referral_id', referralIds)
            .order('occurred_at', { ascending: false })
            .limit(limit),
        'what your referred clients have been doing',
      )
    : Promise.resolve(ok<ReferralEvent[]>([]))

export const listReferralOrders = (referralIds: string[]) =>
  referralIds.length
    ? many<ReferralOrder>(
        (sb) => sb.from('referral_order').select('*').in('referral_id', referralIds).order('ordered_on', { ascending: false }),
        'referred orders',
      )
    : Promise.resolve(ok<ReferralOrder[]>([]))

// ----------------------------------------------------------------- rewards

export const listRewardTiers = () =>
  many<RewardTier>((sb) => sb.from('reward_tier').select('*').eq('active', true).order('threshold'), 'the rewards ladder')

export const listRewardClaims = () =>
  many<RewardClaim>((sb) => sb.from('reward_claim').select('*').order('tier_id'), 'your rewards')

// --------------------------------------------------------------- portfolio

export const listPortfolio = () =>
  many<PortfolioItem>(
    (sb) => sb.from('portfolio_item').select('*').order('sort_order').order('created_at'),
    'your portfolio',
  )

export const getPortfolioItem = (id: string) =>
  one<PortfolioItem>((sb) => sb.from('portfolio_item').select('*').eq('id', id).maybeSingle(), 'this portfolio piece')

// ---------------------------------------------------------------- activity

/**
 * What Material Depot has done with this firm. RLS hides the rows staff marked
 * internal, so this returns the partner-visible history and nothing else — there
 * is no `visible_to_partner` filter here on purpose, because adding one would
 * hide a policy bug rather than surface it.
 */
export const listActivity = (limit = 50) =>
  many<PartnerActivity>(
    (sb) => sb.from('partner_activity').select('*').order('occurred_at', { ascending: false }).limit(limit),
    'your account history',
  )
