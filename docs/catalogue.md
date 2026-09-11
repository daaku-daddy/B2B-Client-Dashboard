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

There are **two walls, and Cloudflare is the outer one.** Verified from the live
Vercel deployment on 2026-09-11 — not inferred from a laptop:

| Where the request comes from | What stops it |
|---|---|
| A browser on `materialdepot.com` | Django: `403`, CSRF / untrusted origin |
| This laptop via curl | Cloudflare, before Django sees it |
| **The live Vercel function** | **Cloudflare**, before Django sees it |

So the first ask is **not** a Django change. `api.materialdepot.com` sits behind
Cloudflare bot protection that rejects datacentre egress, which is what every
Vercel function is. Whoever owns that Cloudflare zone has to let this
deployment through — an allowlisted egress IP, a WAF skip rule for the API
hostname, or a shared header the rule trusts.

**Then** the Django wall is still there, and
`b2b-client-dashboard-eight.vercel.app` will need adding to
`CSRF_TRUSTED_ORIGINS` / the CORS allowlist. Expect to fix both, in that order,
and to see the 502's `error` string change from the Cloudflare message to the
CSRF one in between — that string is how you tell which wall you are at.

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

### Its images come in two shapes, and only one of them is a picture

| Path | What it is |
|---|---|
| `/cdn-img/azure/application_image/<scene>-medres.jpg` | **the scene photograph** — 40–120 KB, what the gallery shows |
| `/cdn-img/main/general-images/<uuid>.png` | a scene compositing **layer** — ~2 KB, near-transparent |

Both return `200 image/webp` through the transform proxy, so a `curl -o
/dev/null -w %{http_code}` check passes on either. The seed used the uuid ones
first and every board cover rendered as a blank white box — the image had
loaded, `naturalWidth` was 800, and there was nothing to see. Check the byte
size, not just the status.

Per-product swatches are not fetchable at all: palette draws them to a canvas,
so there is no URL behind them.
