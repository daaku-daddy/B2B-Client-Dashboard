# Quotes

**Covers:** `components/quote/** · lib/quote/pdf.ts · lib/domain/money.ts · buildQuoteFromApprovedBoards · acceptQuote`

## Built from what the client signed off

`buildQuoteFromApprovedBoards(projectId, markupPct)` walks every board with
`status = 'approved'` and copies its products into `quote_line` rows. Lines are
**copied, not referenced** — `quote_line` carries its own sku, qty, unit, rate
and GST, and `board_item_id` is `ON DELETE SET NULL` so deleting a board cannot
silently empty a quote that has already gone to a client.

Two things are skipped and **reported by name**:

- an item with no quantity — a zero-quantity line in a client-facing quote reads
  as "free",
- an item with no unit — it cannot be priced at all.

If nothing survives, the action fails with the list rather than creating an
empty quote. If lines fail to insert *after* the quote row is created, it says
so explicitly ("v3 was created but its lines failed to save — delete it and try
again") rather than returning success on a half-built quote someone would then
send.

Rebuilding bumps `version` and marks previous **drafts** `superseded`, so there
is one live draft per project. Shared and accepted quotes are left alone.

## Two numbers, side by side

| Column | What it is |
|---|---|
| MD rate / MD amount | what Material Depot charges, GST included |
| Markup | the quote's `markup_pct`, or the line's own `line_markup_pct` if set |
| Client pays | the marked-up figure |
| Your margin | the difference |

All of it lives in `lineMath()` / `quoteTotals()` in `lib/domain/money.ts`, and
that file's header is the authority on tax direction: **rates are inclusive**,
so GST is backed out for display and never added on. Getting that backwards
makes every quote in the system wrong by 18%.

`line_markup_pct` is nullable and `null` means "use the quote's" — the input
shows the quote's value as a placeholder so an empty box is not mistaken for 0%.

## The client PDF shows one of those two numbers

`lib/quote/pdf.ts` prints the marked-up figures only. The Material Depot rate and
the architect's margin appear nowhere in the file. Not in a hidden column, not
in light grey — a PDF gets forwarded.

Lines are grouped by room, because that is how a client reads a house. The
firm's own name, contact, phone, city and GSTIN come from the partner record via
the `firm` prop.

## Accepting is one action, not two

`acceptQuote()` marks the quote accepted, **seeds the procurement list from its
lines**, and moves the project to the `procurement` stage. One action because a
project sitting in `design` with an accepted quote and an empty procurement list
is a state nobody can act on.

It only seeds lines that are not already there, so accepting twice does not
double the list. An accepted quote also locks its line editing in the UI.
