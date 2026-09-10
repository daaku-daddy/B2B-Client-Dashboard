import { round2 } from './money'

/**
 * Turning an area into a quantity, without ever guessing the unit.
 *
 * Material Depot sells the same tile by the box, the square foot and the piece,
 * and the unit is a property of the catalogue row — never something to infer
 * from the category. So this takes the unit as given and reports one of THREE
 * outcomes, not two:
 *
 *   - `ok`        — here is the quantity
 *   - `manual`    — the unit is not area-based (pieces, sets, running feet);
 *                   the architect has to type the number
 *   - `unknown`   — the unit IS box-like but the row carries no coverage area,
 *                   so boxes cannot be computed. This is NOT the same as
 *                   "manual", and the UI says so, because silently asking for a
 *                   manual entry hides a bad catalogue row.
 */

const AREA_UNITS = ['sqft', 'sq ft', 'sq.ft', 'square feet', 'sqmt', 'sqm', 'sq m', 'sq mt']
const BOX_UNITS = ['box', 'boxes', 'carton', 'ctn', 'pack', 'packet', 'bundle', 'roll']

export type QtyBasis =
  | { outcome: 'ok'; qty: number; unit: string; note: string }
  | { outcome: 'manual'; unit: string; note: string }
  | { outcome: 'unknown'; unit: string; note: string }

function normalise(unit: string) {
  return unit.trim().toLowerCase().replace(/[.]/g, '')
}

export function isAreaUnit(unit: string | null | undefined) {
  return !!unit && AREA_UNITS.includes(normalise(unit))
}

export function isBoxUnit(unit: string | null | undefined) {
  return !!unit && BOX_UNITS.some((b) => normalise(unit).startsWith(b))
}

export function quantityFromArea(args: {
  areaSqft: number | null | undefined
  unit: string | null | undefined
  coverageArea: number | null | undefined
  wastagePct: number
}): QtyBasis {
  const unit = args.unit?.trim() || ''
  const wastage = 1 + (args.wastagePct || 0) / 100

  if (!unit) return { outcome: 'unknown', unit: '', note: 'This product has no unit on it — pick the unit before setting a quantity.' }
  if (!args.areaSqft || args.areaSqft <= 0) {
    return { outcome: 'manual', unit, note: 'No area recorded for this room yet — enter the quantity, or add the area on the room.' }
  }

  const withWastage = args.areaSqft * wastage

  if (isAreaUnit(unit)) {
    return {
      outcome: 'ok',
      qty: round2(withWastage),
      unit,
      note: `${round2(args.areaSqft)} sqft + ${args.wastagePct || 0}% wastage`,
    }
  }

  if (isBoxUnit(unit)) {
    if (!args.coverageArea || args.coverageArea <= 0) {
      return {
        outcome: 'unknown',
        unit,
        note: `Sold by the ${unit}, but the catalogue row carries no coverage area — boxes cannot be worked out from ${round2(args.areaSqft)} sqft.`,
      }
    }
    const boxes = Math.ceil(withWastage / args.coverageArea)
    return {
      outcome: 'ok',
      qty: boxes,
      unit,
      note: `${round2(withWastage)} sqft ÷ ${args.coverageArea} sqft per ${unit}, rounded up`,
    }
  }

  return {
    outcome: 'manual',
    unit,
    note: `Sold by the ${unit} — not an area, so the quantity has to be entered.`,
  }
}
