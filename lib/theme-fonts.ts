/**
 * Theme fonts in the Studio (J4-FONTS, Studio half).
 *
 * Build-time flag NEXT_PUBLIC_THEME_FONT_SELECTION_ENABLED (literal "true" = on, default off).
 * A saved or build theme selection may carry two optional fields, `font_family` (body) and
 * `font_family_heading` (heading); they travel in `user_message.data.theme` (and the profile
 * save body) under exactly those names. Contract: Theme Builder !52
 * (TB_FONT_SELECTION_ENABLED) and Director !466 (DIRECTOR_THEME_FONT_SELECTION_ENABLED).
 *
 * Rules:
 *  - Only the eight families Theme Builder approves and Layout's viewer preloads are allowed.
 *    Director refuses anything else on profile save (422) and drops it at build.
 *  - A field that is not chosen is ABSENT: never null, never blank, never "default".
 *  - Flag off: no font key survives anywhere, so every selection, save body and `data.theme`
 *    is byte-identical to the build before this flag existed (even if a backend returns fonts).
 *
 * Import-free on purpose: the node contract test compiles this file alone.
 */

/** The try only guards sandboxes without `process` (the node tests); Next inlines the value. */
function readThemeFontSelectionFlag(): boolean {
  try {
    return process.env.NEXT_PUBLIC_THEME_FONT_SELECTION_ENABLED === 'true'
  } catch {
    return false
  }
}

export const THEME_FONT_SELECTION_ENABLED = readThemeFontSelectionFlag()

/** Exact strings, in picker order. Same eight as Director's allowlist and TB's SELECTABLE_FONTS. */
export const THEME_FONT_FAMILIES = [
  'Inter',
  'Poppins',
  'Roboto',
  'Open Sans',
  'Lato',
  'Montserrat',
  'Playfair Display',
  'Lora',
] as const

export type ThemeFontFamily = typeof THEME_FONT_FAMILIES[number]
export type ThemeFontField = 'font_family' | 'font_family_heading'

/** Body first, heading second: the order Director emits them in (fonts after the colour keys). */
export const THEME_FONT_FIELDS: readonly ThemeFontField[] = ['font_family', 'font_family_heading']

export interface ThemeFontFields {
  /** Body font. */
  font_family?: string
  /** Heading font. */
  font_family_heading?: string
}

/** The supported family `value` names (trimmed, case-insensitive), in its canonical spelling. */
export function canonicalThemeFont(value: unknown): ThemeFontFamily | undefined {
  if (typeof value !== 'string') return undefined
  const wanted = value.trim().toLowerCase()
  return THEME_FONT_FAMILIES.find(name => name.toLowerCase() === wanted)
}

/**
 * The supported fonts `source` carries, as `{ font_family?, font_family_heading? }`.
 * `{}` with the flag off, or when it names none. Null, blank and unsupported entries are absent.
 */
export function themeFontFields(source: unknown): ThemeFontFields {
  const out: ThemeFontFields = {}
  if (!THEME_FONT_SELECTION_ENABLED || !source || typeof source !== 'object') return out
  const raw = source as Record<string, unknown>
  for (const field of THEME_FONT_FIELDS) {
    const family = canonicalThemeFont(raw[field])
    if (family) out[field] = family
  }
  return out
}

function withFonts<T extends ThemeFontFields>(selection: T, fonts: ThemeFontFields): T {
  const { font_family: _body, font_family_heading: _heading, ...rest } = selection
  return { ...rest, ...fonts } as T
}

/**
 * `selection` under the flag's policy: flag off removes any font key, flag on keeps only
 * supported families (canonical spelling, body then heading, after the colour keys).
 * Returns the SAME object when nothing changes, so a font-free selection is untouched.
 */
export function applyThemeFontPolicy<T extends ThemeFontFields>(selection: T): T {
  if (!selection || typeof selection !== 'object') return selection
  const present = THEME_FONT_FIELDS.filter(field => field in selection)
  if (present.length === 0) return selection
  const wanted = themeFontFields(selection)
  if (present.every(field => selection[field] !== undefined && selection[field] === wanted[field])) return selection
  return withFonts(selection, wanted)
}

/** Set one font on a selection, or clear it (a missing, blank or unsupported value removes the key). */
export function setThemeFont<T extends ThemeFontFields>(selection: T, field: ThemeFontField, value: unknown): T {
  const current = themeFontFields(selection)
  const family = THEME_FONT_SELECTION_ENABLED ? canonicalThemeFont(value) : undefined
  const next: ThemeFontFields = {}
  for (const name of THEME_FONT_FIELDS) {
    const chosen = name === field ? family : current[name]
    if (chosen) next[name] = chosen
  }
  return withFonts(selection, next)
}

/** True when both name the same fonts. Flag off it is always true, so a colour comparison stays what it was. */
export function themeFontsEqual(a: unknown, b: unknown): boolean {
  if (!THEME_FONT_SELECTION_ENABLED) return true
  const left = themeFontFields(a)
  const right = themeFontFields(b)
  return THEME_FONT_FIELDS.every(field => left[field] === right[field])
}

/**
 * The refusal text to show when Director rejects a save over a font
 * ("invalid body: font_family must be one of: Inter, Poppins, ..."), else null.
 */
export function themeFontRefusal(error: unknown): string | null {
  if (!THEME_FONT_SELECTION_ENABLED || !error) return null
  const message = typeof error === 'string' ? error : (error as { message?: unknown }).message
  if (typeof message !== 'string') return null
  const match = /font_family(?:_heading)? must be one of: [^\n]*/.exec(message)
  return match ? match[0] : null
}

/** Google Fonts stylesheet for the eight families (regular and bold), so the pickers and specimen can show them. */
export const THEME_FONT_STYLESHEET_HREF = 'https://fonts.googleapis.com/css2?'
  + THEME_FONT_FAMILIES.map(name => `family=${name.replace(/ /g, '+')}:wght@400;700`).join('&')
  + '&display=swap'

export const THEME_FONT_STYLESHEET_ID = 'deckster-theme-font-families'

/**
 * Add the stylesheet once (flag on, in a browser). The Studio page itself only self-hosts Inter
 * under a generated name, so the other seven would otherwise render in the fallback.
 */
export function ensureThemeFontStylesheet(
  doc: Document | undefined = typeof document === 'undefined' ? undefined : document,
): boolean {
  if (!THEME_FONT_SELECTION_ENABLED || !doc) return false
  if (doc.getElementById(THEME_FONT_STYLESHEET_ID)) return true
  const link = doc.createElement('link')
  link.id = THEME_FONT_STYLESHEET_ID
  link.rel = 'stylesheet'
  link.href = THEME_FONT_STYLESHEET_HREF
  doc.head.appendChild(link)
  return true
}

/** CSS `font-family` for a chosen family: the family first, then a generic fallback of the same style. */
export function themeFontCss(family: string): string {
  const serif = family === 'Playfair Display' || family === 'Lora'
  return `'${family}', ${serif ? 'Georgia, serif' : 'system-ui, sans-serif'}`
}
