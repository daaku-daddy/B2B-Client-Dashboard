/**
 * Theme customisation — PRD §13.3.
 *
 * "The workspace should feel like the partner's own brand." Six curated presets,
 * or a custom primary and accent against a light or dark base.
 *
 * §13.3 sets four constraints and three of them are enforced here:
 *
 * 1. **WCAG AA contrast, "rejecting or auto-adjusting combinations that fail".**
 *    `checkTheme()` computes the real contrast ratio and refuses a colour that
 *    cannot carry white text at 4.5:1. A partner whose brand colour is a pale
 *    yellow gets told, rather than getting a workspace whose buttons have
 *    invisible labels.
 *
 * 2. **Status colours are not themeable.** Success, warning and error are absent
 *    from everything this file emits. That is the rule that stops a theme making
 *    a destructive action ambiguous, and it is enforced by scope rather than by
 *    a lint: `cssVariables()` can only write brand tokens because those are the
 *    only names it knows.
 *
 * 3. **Core content surfaces stay neutral for readability.** Ink, ground,
 *    surface and line are not emitted either. Theming reaches navigation,
 *    buttons, chips, charts and progress bars — not the paper.
 *
 * The fourth, "reset to default always available", is a button in Settings.
 */

export type ThemeBase = 'light' | 'dark'

export type Preset = {
  key: string
  label: string
  primary: string
  accent: string
  base: ThemeBase
}

/** §13.3 asks for 6–8. These are the curated set. */
export const PRESETS: Preset[] = [
  // #c4581c — the shade this app shipped with — measures 4.41:1 against white,
  // which is under AA's 4.5 for normal text. Nobody would spot that by eye and
  // `checkTheme()` spotted it on the first run of the preset test. Two shades
  // darker clears it at 4.76 and is indistinguishable side by side, so the fix
  // is the colour rather than an exemption for our own brand from the rule we
  // are about to enforce on partners'.
  { key: 'default', label: 'Material Depot', primary: '#bd5318', accent: '#b08320', base: 'light' },
  { key: 'neutral', label: 'Neutral', primary: '#4a4a4a', accent: '#7c7368', base: 'light' },
  { key: 'warm', label: 'Warm clay', primary: '#a4472e', accent: '#c98a3e', base: 'light' },
  { key: 'earth', label: 'Earth', primary: '#5c6b4a', accent: '#8a7a4e', base: 'light' },
  { key: 'indigo', label: 'Indigo', primary: '#3a4a8c', accent: '#5f7ab5', base: 'light' },
  { key: 'forest', label: 'Forest', primary: '#2d5a44', accent: '#6d8f5e', base: 'light' },
  { key: 'plum', label: 'Plum', primary: '#6b3a5e', accent: '#a05f84', base: 'light' },
  { key: 'slate', label: 'Slate', primary: '#37474f', accent: '#607d8b', base: 'light' },
]

export const DEFAULT_PRESET = PRESETS[0]

// ------------------------------------------------------------- contrast

/** sRGB relative luminance, per WCAG 2.1. */
function luminance(hex: string): number | null {
  const rgb = parseHex(hex)
  if (!rgb) return null
  const f = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2])
}

export function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  let h = m[1]
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

/** WCAG contrast ratio between two colours, 1–21. `null` if either is unparseable. */
export function contrast(a: string, b: string): number | null {
  const la = luminance(a)
  const lb = luminance(b)
  if (la === null || lb === null) return null
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100
}

export const AA_NORMAL = 4.5
export const AA_LARGE = 3

export type ThemeCheck =
  | { ok: true; contrast: number }
  | { ok: false; reason: 'unparseable' }
  | { ok: false; reason: 'low_contrast'; contrast: number; needed: number }

/**
 * Can white button text sit on this colour?
 *
 * Checked against white and not against the page background, because the thing
 * that actually breaks is a primary button: the nav and the chips put the colour
 * on a tint, but `Button variant="primary"` puts white on it flat, and that is
 * the surface a partner clicks to send a quote.
 */
export function checkTheme(primary: string): ThemeCheck {
  const c = contrast(primary, '#ffffff')
  if (c === null) return { ok: false, reason: 'unparseable' }
  if (c < AA_NORMAL) return { ok: false, reason: 'low_contrast', contrast: c, needed: AA_NORMAL }
  return { ok: true, contrast: c }
}

// ------------------------------------------------------------- emission

function shade(hex: string, amount: number): string {
  const rgb = parseHex(hex)
  if (!rgb) return hex
  const to = amount < 0 ? 0 : 255
  const t = Math.abs(amount)
  const mix = rgb.map((c) => Math.round(c + (to - c) * t))
  return `#${mix.map((c) => c.toString(16).padStart(2, '0')).join('')}`
}

export type ThemeInput = {
  theme_preset?: string | null
  theme_primary?: string | null
  theme_accent?: string | null
  theme_base?: ThemeBase | null
}

export function resolveTheme(p: ThemeInput | null | undefined): { primary: string; accent: string; base: ThemeBase } {
  const preset = PRESETS.find((x) => x.key === (p?.theme_preset ?? 'default')) ?? DEFAULT_PRESET
  const primary = p?.theme_primary?.trim() || preset.primary
  const accent = p?.theme_accent?.trim() || preset.accent
  // A custom colour that fails AA is not applied. It is stored — a partner's
  // brand colour is their brand colour and deleting it would be rude — but the
  // workspace falls back to the preset so the buttons stay readable, and
  // Settings says so.
  const safe = checkTheme(primary).ok ? primary : preset.primary
  return { primary: safe, accent, base: p?.theme_base ?? preset.base }
}

/**
 * The CSS custom properties a firm's theme overrides — and ONLY these.
 *
 * Six names. Not ink, not ground, not surface, not line, and above all not
 * good/warn/bad. The list being short is the feature: it is what makes "status
 * colours are not themeable" a property of the code rather than a promise in a
 * document.
 */
export function cssVariables(p: ThemeInput | null | undefined): string {
  const { primary, accent } = resolveTheme(p)
  if (primary === DEFAULT_PRESET.primary && accent === DEFAULT_PRESET.accent) return ''
  return [
    `--color-brand:${primary}`,
    `--color-brand-hover:${shade(primary, -0.18)}`,
    `--color-brand-soft:${shade(primary, 0.92)}`,
    `--color-brand-line:${shade(primary, 0.72)}`,
    `--color-gold:${accent}`,
  ].join(';')
}
