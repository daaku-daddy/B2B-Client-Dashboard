/**
 * The money rules, in one place, because getting tax direction wrong is the
 * easiest way to make every quote in the system wrong by 18%.
 *
 * **Material Depot rates are TAX-INCLUSIVE.** The catalogue field the app reads
 * is `selling_price_with_tax`, and `board_item.rate` / `quote_line.rate` hold
 * exactly that value. So:
 *
 *   - `qty × rate` is what the client pays Material Depot for the material,
 *     GST included. Nothing is added on top for tax.
 *   - the GST component is BACKED OUT for display (`taxOf`), never added.
 *   - the architect's markup is applied to the tax-inclusive amount, because
 *     that is the number the architect is marking up in practice.
 *
 * If a rate ever arrives ex-tax from somewhere else, convert it before storing
 * it. Do not add a second "is this inclusive" flag — one convention, enforced
 * here.
 */

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/** The GST hiding inside a tax-inclusive amount. */
export function taxOf(amountInclusive: number, gstPct: number) {
  if (!gstPct) return 0
  return round2(amountInclusive - amountInclusive / (1 + gstPct / 100))
}

export function exTax(amountInclusive: number, gstPct: number) {
  if (!gstPct) return round2(amountInclusive)
  return round2(amountInclusive / (1 + gstPct / 100))
}

export type LineInput = {
  qty: number
  rate: number
  gst_pct: number
  /** null on a line means "use the quote's markup" */
  line_markup_pct: number | null
}

export type LineMath = {
  /** what Material Depot charges, GST included */
  mdAmount: number
  /** the GST already inside mdAmount */
  tax: number
  /** the markup percentage actually used on this line */
  markupPct: number
  /** what the client is quoted, GST included */
  clientAmount: number
  /** clientAmount − mdAmount */
  margin: number
}

export function lineMath(line: LineInput, quoteMarkupPct: number): LineMath {
  const mdAmount = round2((line.qty || 0) * (line.rate || 0))
  const markupPct = line.line_markup_pct ?? quoteMarkupPct ?? 0
  const clientAmount = round2(mdAmount * (1 + markupPct / 100))
  return {
    mdAmount,
    tax: taxOf(mdAmount, line.gst_pct || 0),
    markupPct,
    clientAmount,
    margin: round2(clientAmount - mdAmount),
  }
}

export type QuoteTotals = {
  lines: number
  mdAmount: number
  tax: number
  clientSubtotal: number
  discount: number
  clientTotal: number
  margin: number
  marginPct: number
}

export function quoteTotals(
  lines: LineInput[],
  quote: { markup_pct: number; discount: number },
): QuoteTotals {
  let mdAmount = 0
  let tax = 0
  let clientSubtotal = 0
  for (const l of lines) {
    const m = lineMath(l, quote.markup_pct)
    mdAmount += m.mdAmount
    tax += m.tax
    clientSubtotal += m.clientAmount
  }
  const discount = quote.discount || 0
  const clientTotal = round2(clientSubtotal - discount)
  const margin = round2(clientTotal - mdAmount)
  return {
    lines: lines.length,
    mdAmount: round2(mdAmount),
    tax: round2(tax),
    clientSubtotal: round2(clientSubtotal),
    discount: round2(discount),
    clientTotal,
    margin,
    // Margin as a share of what the client pays, which is how a designer reads
    // it. Guard the divide — an empty quote is 0%, not NaN%.
    marginPct: clientTotal > 0 ? round2((margin / clientTotal) * 100) : 0,
  }
}
