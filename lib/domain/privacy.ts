/**
 * End-client privacy — PRD §14.5, under India's DPDP Act.
 *
 * A partner sees an end customer's store visits, cart contents and order values.
 * That is legitimate and it is also somebody else's personal data, so three
 * rules apply and all three live here:
 *
 * 1. **Phone masking.** `98XXXXXX21` by default, with a reveal action that is
 *    LOGGED. The mask keeps the first two and last two digits, which is enough
 *    for an architect to recognise a client they already know and not enough to
 *    ring a client they do not.
 *
 * 2. **No consent, no itemised view.** Without confirmed consent the partner
 *    sees aggregate facts only — visited yes/no, ordered yes/no, an order value
 *    BAND. Not the cart, not the line items, not the exact figure.
 *
 * 3. **Never in an export.** Full numbers do not appear in a CSV for the Design
 *    Team or Procurement roles at all.
 */

import { phone10 } from '../format.ts'

/** `9876543210` → `98XXXXXX10`. Anything that is not a ten-digit mobile is
 *  masked whole rather than partly — a malformed number could be anything. */
export function maskPhone(raw: string | null | undefined): string {
  const p = phone10(raw)
  if (!p) return raw ? '•••••' : '—'
  return `${p.slice(0, 2)}XXXXXX${p.slice(8)}`
}

/**
 * Consent state, as three values rather than a boolean.
 *
 * `unknown` is not `denied`. A client we have simply not asked yet is a client
 * the KAM should ask, and folding that into "refused" loses the only signal that
 * would prompt anyone to. It is the same rule as the phone-matching one in
 * `docs/referrals.md`: matched, no-match and could-not-tell are three outcomes.
 */
export type Consent = 'given' | 'refused' | 'unknown'

export function consentOf(row: { consent_given?: boolean | null } | null | undefined): Consent {
  if (!row || row.consent_given === null || row.consent_given === undefined) return 'unknown'
  return row.consent_given ? 'given' : 'refused'
}

export const CONSENT_COPY: Record<Consent, { label: string; detail: string }> = {
  given: {
    label: 'Sharing agreed',
    detail: 'This client has agreed we can share what they do with us with your firm.',
  },
  refused: {
    label: 'Sharing declined',
    detail:
      'This client has asked us not to share their activity. You can see whether they visited and whether they ordered, and nothing itemised.',
  },
  unknown: {
    label: 'Consent not confirmed',
    detail:
      'We have not yet confirmed with this client that we can share their activity with you. Until we have, you see whether they visited and whether they ordered, and nothing itemised. Your key account manager can chase it.',
  },
}

export const itemisedVisible = (c: Consent) => c === 'given'

/**
 * The value band a partner sees when consent is not confirmed (§14.5).
 * Bands, never the figure — a band cannot be reconciled back to one invoice.
 */
const BANDS: { max: number; label: string }[] = [
  // Zero is "nothing has counted", NOT "they never ordered". Two orders that
  // are still maturing produce a zero here, and labelling that "No order yet"
  // put a flat contradiction next to "Placed an order: Yes".
  { max: 0, label: 'Nothing yet' },
  { max: 50_000, label: 'Under ₹50 K' },
  { max: 1_00_000, label: '₹50 K – ₹1 L' },
  { max: 2_50_000, label: '₹1 L – ₹2.5 L' },
  { max: 5_00_000, label: '₹2.5 L – ₹5 L' },
  { max: 10_00_000, label: '₹5 L – ₹10 L' },
  { max: Infinity, label: 'Over ₹10 L' },
]

export function valueBand(n: number | null | undefined): string {
  const v = Number(n) || 0
  if (v <= 0) return BANDS[0].label
  return (BANDS.find((b) => v <= b.max) ?? BANDS[BANDS.length - 1]).label
}
