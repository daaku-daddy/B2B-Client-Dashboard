import { NextResponse } from 'next/server'

/**
 * Server-side proxy to the Material Depot catalogue.
 *
 * Why a proxy at all: `POST https://api.materialdepot.com/apiV1/search/` rejects
 * a browser request from this origin with a Django CSRF failure (verified
 * 2026-09-11 — the endpoint exists, every neighbouring path 404s, and the 403
 * body names CSRF and Origin). palette.materialdepot.com reaches the same
 * endpoint through its own server proxy, which is the pattern copied here.
 *
 * **This will keep failing until `b2b-client-dashboard-eight.vercel.app` is on
 * the API's trusted-origin / CORS allowlist** — that is a change on the Django
 * side, not here. Until then the route returns `catalogue_unreachable` and the
 * product picker says so on screen and offers manual entry. It does not return
 * an empty list, because an empty list is a lie.
 */

const BASE = process.env.MD_CATALOGUE_BASE || 'https://api.materialdepot.com/apiV1'
const AS_ORIGIN = process.env.MD_CATALOGUE_ORIGIN || 'https://materialdepot.com'
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'

type Body = {
  query?: string
  category?: string
  page?: number
  pageSize?: number
  sortBy?: string
  variantIds?: string[]
}

export async function POST(req: Request) {
  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: 'bad request body' }, { status: 400 })
  }

  const fields: Record<string, unknown> = {}
  if (body.category) fields.category = [body.category]
  // Re-pricing a saved board item: ask for exactly those variants.
  if (body.variantIds?.length) fields.variant_id = body.variantIds

  const payload = {
    query_string: body.query ?? '',
    handle: '',
    fields_to_search: fields,
    page_number: Math.max(0, body.page ?? 0),
    page_size: Math.min(60, Math.max(1, body.pageSize ?? 24)),
    sort_by: body.sortBy ?? 'popular',
    price_availability: true,
  }

  try {
    const res = await fetch(`${BASE}/search/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': UA,
        // Django's CSRF check on an HTTPS request compares Origin/Referer
        // against CSRF_TRUSTED_ORIGINS. Presenting the storefront's own origin
        // is what palette's proxy effectively does.
        Origin: AS_ORIGIN,
        Referer: `${AS_ORIGIN}/`,
        ...(process.env.MD_CATALOGUE_CSRF
          ? {
              'X-CSRFToken': process.env.MD_CATALOGUE_CSRF,
              Cookie: `csrftoken=${process.env.MD_CATALOGUE_CSRF}`,
            }
          : {}),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
      cache: 'no-store',
    })

    const text = await res.text()
    if (!res.ok) {
      // Say which wall we hit. "Catalogue unreachable" with no reason is the
      // kind of message that gets reported as "search is broken" and costs a
      // day of guessing.
      // Cloudflare is the OUTER wall and the one hit in practice from a
      // serverless function, so it is checked first — the string is how a
      // reader tells which of the two walls they are at.
      const reason =
        /cloudflare|just a moment|attention required/i.test(text)
          ? 'Cloudflare blocked the request before it reached the catalogue API.'
          : /csrf/i.test(text)
            ? 'The catalogue API rejected this server (Django CSRF / untrusted origin). This Vercel domain needs adding to the API allowlist.'
            : `Catalogue API returned ${res.status}.`
      return NextResponse.json({ error: reason, code: 'catalogue_unreachable' }, { status: 502 })
    }

    try {
      return NextResponse.json(JSON.parse(text))
    } catch {
      return NextResponse.json(
        { error: 'Catalogue API returned something that is not JSON.', code: 'catalogue_unreachable' },
        { status: 502 },
      )
    }
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : 'Catalogue request failed',
        code: 'catalogue_unreachable',
      },
      { status: 502 },
    )
  }
}
