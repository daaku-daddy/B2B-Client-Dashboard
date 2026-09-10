'use client'

import { toPick, type CatalogPick, type MdSearchResponse } from './types'

/**
 * Three outcomes, never two. A catalogue that is unreachable must not look like
 * a catalogue with no matches — the second sends an architect hunting for a
 * product that exists, and it is exactly how a broken integration hides for a
 * month.
 */
export type CatalogResult =
  | { state: 'ok'; total: number; products: CatalogPick[] }
  | { state: 'empty'; total: 0; products: [] }
  | { state: 'unavailable'; reason: string }

export type CatalogQuery = {
  query?: string
  category?: string
  page?: number
  pageSize?: number
  sortBy?: 'popular' | 'price_asc' | 'price_desc' | 'newest'
}

export async function searchCatalog(q: CatalogQuery, signal?: AbortSignal): Promise<CatalogResult> {
  try {
    const res = await fetch('/api/catalog/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(q),
      signal,
    })
    const body = (await res.json()) as MdSearchResponse & { error?: string }
    if (!res.ok) {
      return { state: 'unavailable', reason: body?.error || `Catalogue returned ${res.status}` }
    }
    const products = (body.product ?? []).map(toPick)
    if (!products.length) return { state: 'empty', total: 0, products: [] }
    return { state: 'ok', total: body.total ?? products.length, products }
  } catch (e) {
    if (signal?.aborted) return { state: 'empty', total: 0, products: [] }
    return { state: 'unavailable', reason: e instanceof Error ? e.message : 'Catalogue request failed' }
  }
}
