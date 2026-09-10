/**
 * The areas of a home, and the surfaces inside each one.
 *
 * This registry is the single source of truth for the area taxonomy and it
 * matches palette.materialdepot.com's own categories, so a board can deep-link
 * into palette for the same room. Adding an area type here needs no migration —
 * `project_area.area_type` is plain text with no CHECK, on purpose.
 */

export type AreaType = {
  key: string
  label: string
  /** palette's category name, when it has one. Used for the deep link. */
  palette?: string
  surfaces: string[]
  /** Which measurement drives quantities for this area. */
  measure: 'floor' | 'wall' | 'both' | 'unit'
}

const S = {
  floor: 'Floor',
  lowerWall: 'Lower Half Wall',
  upperWall: 'Upper Half Wall',
  wall: 'Wall',
  ceiling: 'Ceiling',
  counter: 'Countertop',
  cabinet: 'Cabinet Front',
  backsplash: 'Backsplash',
  shutter: 'Shutter',
  facade: 'Facade',
  deck: 'Deck',
}

export const AREA_TYPES: AreaType[] = [
  { key: 'living_room', label: 'Living Room', palette: 'Living Room', measure: 'both',
    surfaces: [S.floor, S.wall, S.ceiling, 'Feature Wall', 'Skirting'] },
  { key: 'tv_unit', label: 'TV Unit', palette: 'TV Unit', measure: 'wall',
    surfaces: [S.wall, S.shutter, 'Back Panel', 'Open Shelf'] },
  { key: 'dining_room', label: 'Dining Room', palette: 'Dining Room', measure: 'both',
    surfaces: [S.floor, S.wall, S.ceiling, 'Feature Wall'] },
  { key: 'kitchen', label: 'Kitchen', palette: 'Kitchen', measure: 'both',
    surfaces: [S.floor, S.backsplash, S.counter, S.cabinet, S.wall, S.ceiling] },
  { key: 'bedroom', label: 'Bedroom', palette: 'Bedroom', measure: 'both',
    surfaces: [S.floor, S.wall, S.ceiling, 'Headboard Wall'] },
  { key: 'wardrobe', label: 'Wardrobe', palette: 'Wardrobe', measure: 'unit',
    surfaces: [S.shutter, 'Carcass', 'Internal', 'Profile'] },
  { key: 'bathroom', label: 'Bathroom', palette: 'Bathroom', measure: 'both',
    surfaces: [S.floor, S.lowerWall, S.upperWall, S.ceiling, S.counter, S.cabinet, 'Shower Area', 'Highlighter'] },
  { key: 'foyer', label: 'Foyer', palette: 'Foyer', measure: 'both',
    surfaces: [S.floor, S.wall, S.ceiling, 'Door'] },
  { key: 'balcony', label: 'Balcony', palette: 'Balcony', measure: 'both',
    surfaces: [S.floor, S.wall, S.ceiling, 'Railing', 'Planter'] },
  { key: 'pooja_room', label: 'Pooja Room', measure: 'both',
    surfaces: [S.floor, S.wall, S.ceiling, 'Mandir Unit'] },
  { key: 'study', label: 'Study / Home Office', measure: 'both',
    surfaces: [S.floor, S.wall, S.ceiling, 'Desk Top', 'Storage'] },
  { key: 'utility', label: 'Utility', measure: 'both', surfaces: [S.floor, S.wall, 'Counter'] },
  { key: 'staircase', label: 'Staircase', measure: 'unit', surfaces: ['Tread', 'Riser', S.wall, 'Railing'] },
  { key: 'parking', label: 'Parking', palette: 'Parking', measure: 'floor', surfaces: [S.floor, S.wall, 'Ceiling'] },
  { key: 'outdoor', label: 'Outdoor / Terrace', palette: 'outdoor', measure: 'floor',
    surfaces: [S.deck, S.floor, S.facade, 'Boundary Wall', 'Pergola'] },
  { key: 'facade', label: 'Facade / Elevation', measure: 'wall', surfaces: [S.facade, 'Cladding', 'Louvers'] },
  { key: 'common', label: 'Whole Project / Common', measure: 'unit', surfaces: ['Any'] },
]

const BY_KEY = new Map(AREA_TYPES.map((a) => [a.key, a]))

export function areaType(key: string | null | undefined): AreaType | undefined {
  return key ? BY_KEY.get(key) : undefined
}

export function areaLabel(key: string | null | undefined) {
  return areaType(key)?.label ?? key ?? 'Area'
}

export function surfacesFor(key: string | null | undefined) {
  return areaType(key)?.surfaces ?? ['Any']
}

/**
 * A palette deep link for this area. Passing the scene through takes the
 * architect straight back to the visualiser they built the board in; without a
 * scene it opens palette filtered to the room type.
 */
export function paletteUrl(areaKey: string | null | undefined, scene?: string | null) {
  const base = 'https://palette.materialdepot.com/'
  if (scene) return `${base}?scene=${encodeURIComponent(scene)}`
  const cat = areaType(areaKey)?.palette
  return cat ? `${base}?category=${encodeURIComponent(cat)}` : base
}

/** The area types palette can visualise — used to decide whether to offer the link. */
export function hasPaletteScene(areaKey: string | null | undefined) {
  return Boolean(areaType(areaKey)?.palette)
}
