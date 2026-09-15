'use server'

import { revalidatePath } from 'next/cache'
import { supabaseServer } from '@/lib/supabase/server'
import { fail, ok, type Result } from './result'
import { phone10 } from '@/lib/format'
import type { CatalogPick } from '@/lib/catalog/types'

/**
 * Every mutation. Two rules hold throughout:
 *
 * 1. **A failed write is returned, never swallowed.** No `.catch(console.error)`,
 *    no result that gets dropped — the caller gets `{ ok: false, error }` and
 *    puts it on screen. A write nobody can see fail is how a feature looks
 *    finished and is not.
 * 2. **RLS does the authorisation**, so nothing here re-checks partner_id. If a
 *    write succeeds against another firm's row, the policy is wrong and should
 *    be fixed there rather than papered over here.
 */

type Row = Record<string, unknown>

async function insert<T>(table: string, values: Row, what: string, revalidate?: string): Promise<Result<T>> {
  const sb = await supabaseServer()
  const { data, error } = await sb.from(table).insert(values).select().single()
  if (error) return fail(`Could not create ${what}: ${error.message}`)
  if (revalidate) revalidatePath(revalidate)
  return ok(data as T)
}

async function update<T>(table: string, id: string, values: Row, what: string, revalidate?: string): Promise<Result<T>> {
  const sb = await supabaseServer()
  const { data, error } = await sb.from(table).update(values).eq('id', id).select().single()
  if (error) return fail(`Could not update ${what}: ${error.message}`)
  if (revalidate) revalidatePath(revalidate)
  return ok(data as T)
}

async function remove(table: string, id: string, what: string, revalidate?: string): Promise<Result<true>> {
  const sb = await supabaseServer()
  const { error } = await sb.from(table).delete().eq('id', id)
  if (error) return fail(`Could not delete ${what}: ${error.message}`)
  if (revalidate) revalidatePath(revalidate)
  return ok(true as const)
}

async function partnerId(): Promise<Result<string>> {
  const sb = await supabaseServer()
  const { data: auth } = await sb.auth.getUser()
  if (!auth.user) return fail('You are not signed in.')
  const { data, error } = await sb.from('partner_user').select('partner_id').eq('user_id', auth.user.id).maybeSingle()
  if (error) return fail(`Could not read your firm: ${error.message}`)
  if (!data) return fail('Your login is not attached to a firm yet.')
  return ok(data.partner_id as string)
}

// ----------------------------------------------------------------- clients

export async function createClient(input: {
  name: string
  phone?: string | null
  email?: string | null
  city?: string | null
  address?: string | null
  notes?: string | null
}) {
  if (!input.name?.trim()) return fail('A client needs a name.')
  const pid = await partnerId()
  if (!pid.ok) return pid

  // A phone that is present but unusable is rejected rather than stored as
  // null: a silently-dropped number is a referral that can never be matched.
  let phone: string | null = null
  if (input.phone?.trim()) {
    phone = phone10(input.phone)
    if (!phone) return fail(`"${input.phone}" is not a 10-digit Indian mobile number. Leave it blank or correct it.`)
  }

  return insert('client', {
    partner_id: pid.data,
    name: input.name.trim(),
    phone,
    email: input.email?.trim() || null,
    city: input.city?.trim() || null,
    address: input.address?.trim() || null,
    notes: input.notes?.trim() || null,
  }, 'this client', '/clients')
}

export async function updateClient(id: string, values: Row) {
  if (typeof values.phone === 'string' && values.phone.trim()) {
    const p = phone10(values.phone)
    if (!p) return fail('That is not a 10-digit Indian mobile number.')
    values.phone = p
  }
  return update('client', id, values, 'this client', '/clients')
}

export async function deleteClient(id: string) {
  return remove('client', id, 'this client', '/clients')
}

// ---------------------------------------------------------------- projects

export async function createProject(input: {
  client_id: string
  name: string
  project_type?: string
  site_address?: string | null
  city?: string | null
  carpet_area_sqft?: number | null
  budget?: number | null
  design_fee?: number | null
  target_on?: string | null
}) {
  if (!input.name?.trim()) return fail('A project needs a name.')
  if (!input.client_id) return fail('Pick which client this project is for.')
  const pid = await partnerId()
  if (!pid.ok) return pid

  return insert('project', {
    partner_id: pid.data,
    client_id: input.client_id,
    name: input.name.trim(),
    project_type: input.project_type || 'residential',
    site_address: input.site_address?.trim() || null,
    city: input.city?.trim() || null,
    carpet_area_sqft: input.carpet_area_sqft ?? null,
    budget: input.budget ?? null,
    design_fee: input.design_fee ?? null,
    target_on: input.target_on || null,
    started_on: new Date().toISOString().slice(0, 10),
  }, 'this project', '/projects')
}

export async function updateProject(id: string, values: Row) {
  const r = await update('project', id, values, 'this project', `/projects/${id}`)
  revalidatePath('/projects')
  revalidatePath('/dashboard')
  return r
}

export async function deleteProject(id: string) {
  return remove('project', id, 'this project', '/projects')
}

// ------------------------------------------------------------------- areas

export async function createArea(input: {
  project_id: string
  area_type: string
  name: string
  floor_area_sqft?: number | null
  wall_area_sqft?: number | null
  sort_order?: number
}) {
  if (!input.name?.trim()) return fail('The room needs a name.')
  return insert('project_area', {
    project_id: input.project_id,
    area_type: input.area_type,
    name: input.name.trim(),
    floor_area_sqft: input.floor_area_sqft ?? null,
    wall_area_sqft: input.wall_area_sqft ?? null,
    sort_order: input.sort_order ?? 0,
  }, 'this room', `/projects/${input.project_id}`)
}

export async function updateArea(id: string, projectId: string, values: Row) {
  return update('project_area', id, values, 'this room', `/projects/${projectId}`)
}

export async function deleteArea(id: string, projectId: string) {
  return remove('project_area', id, 'this room', `/projects/${projectId}`)
}

// ------------------------------------------------------------------ boards

export async function createBoard(input: { area_id: string; name: string; palette_scene?: string | null; path: string }) {
  return insert('board', {
    area_id: input.area_id,
    name: input.name?.trim() || 'Option 1',
    palette_scene: input.palette_scene || null,
  }, 'this board', input.path)
}

export async function updateBoard(id: string, path: string, values: Row) {
  // Approving one board is a decision about the ROOM, so the caller also flips
  // the other boards — see setApprovedBoard rather than calling this directly.
  return update('board', id, values, 'this board', path)
}

/**
 * Approve one option for a room and un-approve the rest. Written as one action
 * because "approved" is a property of the room's decision, and two approved
 * boards in one room makes the quote ambiguous about which products to bill.
 */
export async function setApprovedBoard(boardId: string, areaId: string, path: string) {
  const sb = await supabaseServer()
  const { error: clearErr } = await sb
    .from('board')
    .update({ status: 'draft', approved_at: null })
    .eq('area_id', areaId)
    .eq('status', 'approved')
  if (clearErr) return fail(`Could not clear the previous approval: ${clearErr.message}`)

  const { error } = await sb
    .from('board')
    .update({ status: 'approved', approved_at: new Date().toISOString() })
    .eq('id', boardId)
  if (error) return fail(`Could not approve this board: ${error.message}`)

  const { error: areaErr } = await sb.from('project_area').update({ status: 'finalised' }).eq('id', areaId)
  if (areaErr) return fail(`Board approved, but the room could not be marked finalised: ${areaErr.message}`)

  revalidatePath(path)
  return ok(true as const)
}

export async function deleteBoard(id: string, path: string) {
  return remove('board', id, 'this board', path)
}

// ------------------------------------------------------------- board items

export async function addProductToBoard(input: {
  board_id: string
  pick: CatalogPick
  surface?: string | null
  qty?: number | null
  wastage_pct?: number
  path: string
}) {
  const p = input.pick
  return insert('board_item', {
    board_id: input.board_id,
    kind: 'product',
    surface: input.surface || null,
    variant_id: p.variant_id,
    sku: p.sku,
    product_name: p.product_name,
    brand: p.brand,
    category: p.category,
    size: p.size,
    finish: p.finish,
    image_url: p.image_url,
    md_url: p.md_url,
    unit: p.unit,
    rate: p.rate,
    mrp: p.mrp,
    gst_pct: p.gst_pct,
    coverage_area: p.coverage_area,
    // Stamped now, so the quote can tell the architect how old its prices are.
    priced_at: new Date().toISOString(),
    qty: input.qty ?? null,
    wastage_pct: input.wastage_pct ?? 0,
  }, 'this product', input.path)
}

export async function addManualItemToBoard(input: {
  board_id: string
  product_name: string
  unit: string
  rate: number
  gst_pct: number
  qty?: number | null
  surface?: string | null
  brand?: string | null
  note?: string | null
  path: string
}) {
  if (!input.product_name?.trim()) return fail('The item needs a name.')
  if (!input.unit?.trim()) return fail('The item needs a unit — that is what the rate is per.')
  return insert('board_item', {
    board_id: input.board_id,
    kind: 'product',
    surface: input.surface || null,
    product_name: input.product_name.trim(),
    brand: input.brand?.trim() || null,
    unit: input.unit.trim(),
    rate: input.rate,
    gst_pct: input.gst_pct,
    qty: input.qty ?? null,
    note: input.note?.trim() || null,
    priced_at: new Date().toISOString(),
  }, 'this item', input.path)
}

export async function updateBoardItem(id: string, path: string, values: Row) {
  return update('board_item', id, values, 'this item', path)
}

export async function deleteBoardItem(id: string, path: string) {
  return remove('board_item', id, 'this item', path)
}

// ------------------------------------------------------------------ quotes

/**
 * Build a quote from every approved board on the project.
 *
 * Lines are copied, not referenced. A quote that reprices itself when someone
 * later edits a board is a quote that cannot be sent to a client, and the
 * snapshot is why `quote_line` carries its own sku / rate / unit columns.
 * Items with no quantity are SKIPPED and reported — a zero-quantity line in a
 * client-facing quote reads as "free".
 */
export async function buildQuoteFromApprovedBoards(projectId: string, markupPct: number) {
  const sb = await supabaseServer()

  const { data: areas, error: areaErr } = await sb
    .from('project_area').select('id, name, area_type').eq('project_id', projectId)
  if (areaErr) return fail(`Could not read the rooms: ${areaErr.message}`)
  if (!areas?.length) return fail('This project has no rooms yet, so there is nothing to quote.')

  const { data: boards, error: boardErr } = await sb
    .from('board').select('id, area_id, name').in('area_id', areas.map((a) => a.id)).eq('status', 'approved')
  if (boardErr) return fail(`Could not read the approved boards: ${boardErr.message}`)
  if (!boards?.length) return fail('No board has been approved yet. Approve one option per room, then build the quote.')

  const { data: items, error: itemErr } = await sb
    .from('board_item').select('*').in('board_id', boards.map((b) => b.id)).eq('kind', 'product')
  if (itemErr) return fail(`Could not read the products on those boards: ${itemErr.message}`)

  const areaById = new Map(areas.map((a) => [a.id, a]))
  const boardById = new Map(boards.map((b) => [b.id, b]))

  const lines: Row[] = []
  const skipped: string[] = []
  for (const it of items ?? []) {
    const board = boardById.get(it.board_id as string)
    const area = board ? areaById.get(board.area_id as string) : undefined
    if (!it.qty || Number(it.qty) <= 0) {
      skipped.push(`${it.product_name ?? 'item'}${area ? ` (${area.name})` : ''} — no quantity set`)
      continue
    }
    if (!it.unit) {
      skipped.push(`${it.product_name ?? 'item'} — no unit on the row, so it cannot be priced`)
      continue
    }
    lines.push({
      board_item_id: it.id,
      area_id: area?.id ?? null,
      area_label: area?.name ?? null,
      description: [it.product_name, it.size, it.surface].filter(Boolean).join(' · '),
      sku: it.sku,
      variant_id: it.variant_id,
      qty: it.qty,
      unit: it.unit,
      rate: it.rate ?? 0,
      gst_pct: it.gst_pct ?? 0,
      sort_order: lines.length,
    })
  }

  if (!lines.length) {
    return fail(
      `Nothing could be quoted. ${skipped.length ? `${skipped.length} item(s) were skipped: ${skipped.slice(0, 3).join('; ')}${skipped.length > 3 ? '…' : ''}` : ''}`,
    )
  }

  const { data: existing } = await sb.from('quote').select('version').eq('project_id', projectId).order('version', { ascending: false }).limit(1)
  const version = (existing?.[0]?.version ?? 0) + 1

  // Older drafts become 'superseded' so there is one live quote per project.
  await sb.from('quote').update({ status: 'superseded' }).eq('project_id', projectId).eq('status', 'draft')

  const { data: quote, error: qErr } = await sb
    .from('quote')
    .insert({ project_id: projectId, version, markup_pct: markupPct, title: `Quote v${version}` })
    .select().single()
  if (qErr) return fail(`Could not create the quote: ${qErr.message}`)

  const { error: lineErr } = await sb.from('quote_line').insert(lines.map((l) => ({ ...l, quote_id: quote.id })))
  if (lineErr) {
    // The quote exists but is empty — say so rather than returning success on a
    // half-built quote the architect would then send.
    return fail(`Quote v${version} was created but its lines failed to save: ${lineErr.message}. Delete it and try again.`)
  }

  revalidatePath(`/projects/${projectId}`)
  return ok({ quote_id: quote.id as string, version, lines: lines.length, skipped })
}

export async function updateQuote(id: string, projectId: string, values: Row) {
  return update('quote', id, values, 'this quote', `/projects/${projectId}`)
}

export async function updateQuoteLine(id: string, projectId: string, values: Row) {
  return update('quote_line', id, values, 'this line', `/projects/${projectId}`)
}

export async function deleteQuoteLine(id: string, projectId: string) {
  return remove('quote_line', id, 'this line', `/projects/${projectId}`)
}

/**
 * Accepting a quote is the moment a project moves from design to procurement,
 * so it does both: marks the quote accepted and seeds the procurement list from
 * its lines. One action, because a project sitting in 'design' with an accepted
 * quote and an empty procurement list is a state nobody can act on.
 */
export async function acceptQuote(quoteId: string, projectId: string) {
  const sb = await supabaseServer()

  const { data: lines, error: lineErr } = await sb.from('quote_line').select('*').eq('quote_id', quoteId)
  if (lineErr) return fail(`Could not read the quote lines: ${lineErr.message}`)
  if (!lines?.length) return fail('This quote has no lines, so there is nothing to procure.')

  const { error: qErr } = await sb
    .from('quote')
    .update({ status: 'accepted', decided_at: new Date().toISOString() })
    .eq('id', quoteId)
  if (qErr) return fail(`Could not mark the quote accepted: ${qErr.message}`)

  // Only seed rows that are not already there, so accepting twice does not
  // double the procurement list.
  const { data: already } = await sb.from('procurement_item').select('quote_line_id').eq('project_id', projectId)
  const have = new Set((already ?? []).map((r) => r.quote_line_id))
  const fresh = lines.filter((l) => !have.has(l.id))

  if (fresh.length) {
    const { error } = await sb.from('procurement_item').insert(
      fresh.map((l) => ({
        project_id: projectId,
        quote_line_id: l.id,
        area_id: l.area_id,
        area_label: l.area_label,
        description: l.description,
        sku: l.sku,
        variant_id: l.variant_id,
        unit: l.unit,
        qty_required: l.qty,
        rate: l.rate,
      })),
    )
    if (error) return fail(`Quote accepted, but the procurement list could not be seeded: ${error.message}`)
  }

  const { error: pErr } = await sb.from('project').update({ stage: 'procurement' }).eq('id', projectId)
  if (pErr) return fail(`Quote accepted and list seeded, but the project stage did not move: ${pErr.message}`)

  revalidatePath(`/projects/${projectId}`)
  revalidatePath('/projects')
  return ok({ seeded: fresh.length, alreadyThere: lines.length - fresh.length })
}

// ------------------------------------------------------------- procurement

export async function updateProcurementItem(id: string, projectId: string, values: Row) {
  return update('procurement_item', id, values, 'this line', `/projects/${projectId}`)
}

export async function addProcurementItem(input: {
  project_id: string
  description: string
  unit: string
  qty_required: number
  rate: number
  area_label?: string | null
}) {
  if (!input.description?.trim()) return fail('The line needs a description.')
  if (!input.unit?.trim()) return fail('The line needs a unit.')
  return insert('procurement_item', {
    project_id: input.project_id,
    description: input.description.trim(),
    unit: input.unit.trim(),
    qty_required: input.qty_required,
    rate: input.rate,
    area_label: input.area_label || null,
  }, 'this line', `/projects/${input.project_id}`)
}

export async function deleteProcurementItem(id: string, projectId: string) {
  return remove('procurement_item', id, 'this line', `/projects/${projectId}`)
}

// ----------------------------------------------------------------- finance

export async function addFinanceEntry(input: {
  project_id: string
  direction: 'cost' | 'income'
  category: string
  description: string
  amount: number
  entry_date: string
  settled?: boolean
  counterparty?: string | null
  reference?: string | null
}) {
  if (!input.description?.trim()) return fail('The entry needs a description.')
  if (!Number.isFinite(input.amount) || input.amount === 0) return fail('The entry needs an amount.')
  return insert('finance_entry', {
    project_id: input.project_id,
    direction: input.direction,
    category: input.category,
    description: input.description.trim(),
    amount: Math.abs(input.amount),
    entry_date: input.entry_date,
    settled: input.settled ?? false,
    counterparty: input.counterparty?.trim() || null,
    reference: input.reference?.trim() || null,
  }, 'this entry', `/projects/${input.project_id}`)
}

export async function updateFinanceEntry(id: string, projectId: string, values: Row) {
  return update('finance_entry', id, values, 'this entry', `/projects/${projectId}`)
}

export async function deleteFinanceEntry(id: string, projectId: string) {
  return remove('finance_entry', id, 'this entry', `/projects/${projectId}`)
}

// --------------------------------------------------------------- referrals

export async function createReferral(input: {
  client_name: string
  md_phone: string
  client_id?: string | null
  project_id?: string | null
  notes?: string | null
}) {
  const pid = await partnerId()
  if (!pid.ok) return pid
  if (!input.client_name?.trim()) return fail('The referral needs the client’s name.')

  const phone = phone10(input.md_phone)
  if (!phone) {
    return fail(
      'A referral needs the client’s exact 10-digit mobile number — that is the only thing that links their store visits and orders back to you.',
    )
  }

  const r = await insert('referral', {
    partner_id: pid.data,
    client_id: input.client_id || null,
    project_id: input.project_id || null,
    client_name: input.client_name.trim(),
    md_phone: phone,
    notes: input.notes?.trim() || null,
  }, 'this referral', '/referrals')

  if (!r.ok && /duplicate key|unique/i.test(r.error)) {
    return fail(`You have already referred ${phone}. Open that referral to see where it has got to.`)
  }
  return r
}

export async function deleteReferral(id: string) {
  return remove('referral', id, 'this referral', '/referrals')
}

// --------------------------------------------------------------- portfolio

/**
 * The work a partner wants on materialdepot.com.
 *
 * A firm owns its own portfolio right up to the point it asks to be published,
 * and not past it: the RLS policies in `004_roles_rls.sql` let a firm move an
 * item draft → submitted and rework a rejected one, and refuse a firm the
 * `published` status entirely. Nothing here re-checks that — if a write of the
 * wrong status succeeds, the policy is wrong and gets fixed there.
 */
export async function createPortfolioItem(input: {
  title: string
  summary?: string | null
  project_type?: string | null
  city?: string | null
  completed_on?: string | null
  area_sqft?: number | null
  cover_url?: string | null
  credits?: string | null
}) {
  if (!input.title?.trim()) return fail('Give the project a name — that is what appears on the site.')
  const pid = await partnerId()
  if (!pid.ok) return pid

  return insert(
    'portfolio_item',
    {
      partner_id: pid.data,
      title: input.title.trim(),
      summary: input.summary?.trim() || null,
      project_type: input.project_type?.trim() || null,
      city: input.city?.trim() || null,
      completed_on: input.completed_on || null,
      area_sqft: input.area_sqft ?? null,
      cover_url: input.cover_url?.trim() || null,
      credits: input.credits?.trim() || null,
      status: 'draft',
    },
    'this portfolio piece',
    '/portfolio',
  )
}

export async function updatePortfolioItem(id: string, values: Row) {
  return update('portfolio_item', id, values, 'this portfolio piece', '/portfolio')
}

/**
 * Hand a piece to Material Depot to look at.
 *
 * Reports the row-level-security refusal rather than swallowing it: a partner
 * who clicks Submit on a published piece needs to be told it is already live,
 * not left looking at a button that does nothing.
 */
export async function submitPortfolioItem(id: string) {
  const sb = await supabaseServer()
  const { data, error } = await sb
    .from('portfolio_item')
    .update({ status: 'submitted', submitted_at: new Date().toISOString() })
    .eq('id', id)
    .select()
  if (error) return fail(`Could not send this for review: ${error.message}`)
  if (!data?.length) {
    return fail(
      'This piece cannot be sent for review — a published piece is locked, and a piece already waiting on us cannot be sent twice.',
    )
  }
  revalidatePath('/portfolio')
  return ok(data[0])
}

export async function deletePortfolioItem(id: string) {
  return remove('portfolio_item', id, 'this portfolio piece', '/portfolio')
}

/**
 * The firm's own studio profile — the part of `partner` a firm is allowed to
 * write. Every other column on that table is frozen by the trigger in
 * `004_roles_rls.sql`, so this deliberately names the writable fields one by one
 * rather than spreading a payload: a stray key would come back as a permission
 * error the user cannot act on.
 */
export async function updateStudioProfile(input: {
  firm_name?: string
  contact_name?: string
  email?: string | null
  city?: string | null
  gst?: string | null
  bio?: string | null
  website?: string | null
  instagram?: string | null
  logo_url?: string | null
}) {
  const pid = await partnerId()
  if (!pid.ok) return pid

  const values: Row = {}
  const text = (v: string | null | undefined) => (v === undefined ? undefined : v?.trim() || null)
  if (input.firm_name !== undefined) {
    if (!input.firm_name.trim()) return fail('A studio needs a name.')
    values.firm_name = input.firm_name.trim()
  }
  if (input.contact_name !== undefined) {
    if (!input.contact_name.trim()) return fail('Your own name cannot be blank.')
    values.contact_name = input.contact_name.trim()
  }
  for (const k of ['email', 'city', 'gst', 'bio', 'website', 'instagram', 'logo_url'] as const) {
    const v = text(input[k])
    if (v !== undefined) values[k] = v
  }
  if (!Object.keys(values).length) return fail('Nothing to save.')

  const r = await update<unknown>('partner', pid.data, values, 'your studio profile', '/portfolio')
  if (r.ok) revalidatePath('/dashboard')
  return r
}
