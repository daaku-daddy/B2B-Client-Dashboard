# The Material Depot catalogue

**Covers:** `app/api/catalog/search/route.ts · lib/catalog/**`

## Where the products come from

`POST https://api.materialdepot.com/apiV1/search/` — 30,750 products with live
prices. Probed 2026-09-11; the endpoint exists (every neighbouring path 404s,
this one 403s) and `palette.materialdepot.com` reaches it through its own server
proxy, which is the pattern `app/api/catalog/search/route.ts` copies.

Request body:

```json
{
  "query_string": "marble tile",
  "handle": "",
  "fields_to_search": { "category": ["Tiles"], "variant_id": ["…"] },
  "page_number": 0,
  "page_size": 24,
  "sort_by": "popular",
  "price_availability": true
}
```

`price_availability: true` is what makes prices come back at all. Response is
`{ total, product: [...], aggregations }`.

## The fields that matter

| Field | Meaning |
|---|---|
| `selling_price_with_tax` | the rate to quote — **GST inclusive** |
| `price_unit` | the unit that rate is per (`sqft`, `box`, `nos`, …) |
| `coverage_area` | sqft per box, when sold by the box |
| `gst` | GST %, already inside the price |
| `variant_id` | the exact key to re-price against later |
| `product_handle` | builds `materialdepot.com/product/<handle>` |
| `out_of_stock` | authoritative stock flag |
| `in_store` | per-store display stock — arrives as a boolean **or** a string, so `toPick` only trusts it when `out_of_stock` is absent |

`variant_images[]` carry an `image_category` array; the preference order
`full_sheet_texture → sample_texture → product_image → surface_closeup` is taken
from palette's own bundle.

## It does not work yet, and that is not a code bug

The API rejects this app's server with a Django CSRF / untrusted-origin 403.
From a laptop, Cloudflare blocks it even earlier. **`b2b-client-dashboard-eight.vercel.app`
needs adding to the API's `CSRF_TRUSTED_ORIGINS` / CORS allowlist** — a change on
the Django side.

Until then the route returns `{ code: 'catalogue_unreachable', error: <which
wall we hit> }` with a 502, and `ProductPicker` says so on screen and offers
manual entry. It deliberately does **not** return an empty product list: an
architect must never be left believing a product does not exist when the truth
is the search never ran.

`MD_CATALOGUE_CSRF` exists as an escape hatch — set it to a `csrftoken` value
and the route sends it as both cookie and `X-CSRFToken`. That is a stopgap for
testing, not the fix.

## Palette

`palette.materialdepot.com` is the room visualiser. Two things are reused here:

- **The area taxonomy.** `lib/domain/areas.ts` matches palette's own categories
  (Bathroom, Kitchen, Living Room, TV Unit, Bedroom, Wardrobe, Balcony, Parking,
  Foyer, Dining Room, outdoor), so a room can deep-link straight into it.
- **The scene slug.** `board.palette_scene` holds palette's `?scene=` value, so
  "Visualise in Palette" reopens the exact scene the board was built from.

Palette's own login is `/api/login-otp` → `/api/verify-otp` (phone + OTP,
returns a bearer token) and it has `/api/wishlist` and `/api/inspiration`. None
of that is wired in here yet — see `docs/auth.md`.
