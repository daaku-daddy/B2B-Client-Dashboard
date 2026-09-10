/**
 * The Material Depot catalogue, as `POST /apiV1/search/` returns it.
 *
 * Field names are taken from the live response (30,750 products, probed
 * 2026-09-11 through palette's proxy). The ones that matter for a quote:
 *
 * | field                      | meaning                                  |
 * |----------------------------|------------------------------------------|
 * | `selling_price_with_tax`   | the rate to quote — **tax inclusive**    |
 * | `price_unit`               | the unit that rate is per                |
 * | `coverage_area`            | sqft per box, when sold by the box       |
 * | `gst`                      | GST %, already inside the price          |
 * | `variant_id`               | the exact key to re-price against later  |
 * | `product_handle`           | builds the materialdepot.com product URL |
 */

export type MdProduct = {
  variant_id: string
  product_id?: string
  sku?: string
  product_name?: string
  private_label_product_name?: string
  brand?: string
  category?: string
  sub_category?: string
  series?: string
  collection?: string
  color?: string
  finish?: string
  size?: string
  thickness?: string
  description?: string
  hsn_code?: string
  label?: string
  price_unit?: string
  md_landing_price_unit?: string
  mrp?: number
  discount?: number
  gst?: number
  selling_price_with_tax?: number
  alternate_unit_selling_price_with_tax?: number
  coverage_area?: number
  in_store?: boolean | string
  out_of_stock?: boolean
  product_handle?: string
  variant_handle?: string
  variant_images?: { image_url: string; image_category: string[] }[]
  images?: { image_url: string; image_category: string[] }[]
  total_sales?: number
  views?: number
}

export type MdSearchResponse = {
  total: number
  product: MdProduct[]
  aggregations?: Record<string, unknown>
}

/** What the app actually needs off a product — the snapshot a board item keeps. */
export type CatalogPick = {
  variant_id: string
  sku: string | null
  product_name: string
  brand: string | null
  category: string | null
  size: string | null
  finish: string | null
  image_url: string | null
  md_url: string | null
  unit: string | null
  rate: number | null
  mrp: number | null
  gst_pct: number | null
  coverage_area: number | null
  in_stock: boolean | null
}

const IMAGE_PREFERENCE = ['full_sheet_texture', 'sample_texture', 'product_image', 'surface_closeup']

function bestImage(p: MdProduct): string | null {
  const list = p.variant_images ?? p.images ?? []
  for (const want of IMAGE_PREFERENCE) {
    const hit = list.find((i) => i.image_category?.includes(want))
    if (hit) return hit.image_url
  }
  return list[0]?.image_url ?? null
}

export function toPick(p: MdProduct): CatalogPick {
  const name = p.product_name || p.private_label_product_name || p.sku || 'Product'
  return {
    variant_id: String(p.variant_id),
    sku: p.sku ?? null,
    product_name: name,
    brand: p.brand ?? null,
    category: p.category ?? null,
    size: p.size ?? null,
    finish: p.finish ?? null,
    image_url: bestImage(p),
    md_url: p.product_handle ? `https://materialdepot.com/product/${p.product_handle}` : null,
    unit: p.price_unit ?? p.md_landing_price_unit ?? null,
    rate: numOrNull(p.selling_price_with_tax),
    mrp: numOrNull(p.mrp),
    gst_pct: numOrNull(p.gst),
    coverage_area: numOrNull(p.coverage_area),
    // `out_of_stock` is the authoritative flag; `in_store` is per-store display
    // stock and arrives as a boolean OR a string depending on the row, so it is
    // only trusted when out_of_stock is absent.
    in_stock:
      typeof p.out_of_stock === 'boolean'
        ? !p.out_of_stock
        : p.in_store === undefined
          ? null
          : p.in_store === true || p.in_store === 'true',
  }
}

function numOrNull(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v) : (v as number)
  return typeof n === 'number' && Number.isFinite(n) ? n : null
}
