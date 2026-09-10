# The design stage

**Covers:** `components/design/** · lib/domain/areas.ts · lib/domain/quantity.ts`

## Rooms, then options, then products

Three levels, and the middle one is the point:

```
project → project_area (a room)  → board (a design OPTION)  → board_item (a product)
```

Several boards per room is deliberate. An architect shows a client two or three
options for the master bath and the client picks one. `setApprovedBoard()`
approves one and **un-approves the rest in that room**, then marks the room
`finalised` — because "approved" is a property of the room's decision, and two
approved options in one room makes the quote ambiguous about what to bill.

`project_area.area_type` is plain text with **no CHECK constraint**, validated
against the registry in `lib/domain/areas.ts`. Adding a room type is a code
change with no migration — which matters in a repo where migrations are pasted
by hand.

Each area type carries its own `surfaces` list (a bathroom has Lower Half Wall,
Shower Area, Highlighter; a wardrobe has Shutter, Carcass, Profile) and a
`measure` saying whether it is driven by floor area, wall area, both, or neither.

## Quantities: three outcomes, never two

`quantityFromArea()` turns a room's area into a quantity, and it never guesses
the unit. Material Depot sells the same tile by the box, the square foot and the
piece, and the unit is a property of the catalogue row. So it reports:

| Outcome | When | What the UI does |
|---|---|---|
| `ok` | area unit, or a box unit **with** a coverage area | offers the wand button, with the working in its tooltip |
| `manual` | the unit is not area-based (nos, sets, running feet), or the room has no area recorded | greys the wand; the architect types the number |
| `unknown` | the unit **is** box-like but the row carries no `coverage_area` | greys the wand **and prints the reason in amber** |

`unknown` is not `manual`. Silently asking for a manual entry would hide a bad
catalogue row; saying "sold by the box, but the row carries no coverage area"
gets it fixed.

Which area is used depends on the surface: floor / deck / tread take
`floor_area_sqft`, everything else takes `wall_area_sqft`. The wand's tooltip
names which one it used, so a wrong number is traceable rather than mysterious.

## Prices are stamped when the product is picked

`addProductToBoard` copies the whole catalogue snapshot onto `board_item` —
name, sku, size, unit, rate, GST, coverage area, image, product URL — and sets
`priced_at`. Nothing re-reads the catalogue afterwards. See house rule 2 in
`CLAUDE.md`.

A product with **no price** is still added, and labelled. Hiding unpriced rows
would look like a catalogue gap; showing them with "No price on this row" lets
the architect put a rate in by hand.

## Palette

`paletteUrl()` deep-links a room into `palette.materialdepot.com`, preferring the
board's own saved `?scene=` slug and falling back to the room's category.
`hasPaletteScene()` gates the button, so rooms palette does not cover (pooja
room, staircase, facade) do not offer a dead link.
