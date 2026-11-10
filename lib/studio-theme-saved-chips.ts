// PASS2D (flag NEXT_PUBLIC_STUDIO_THEME_SAVED_CHIPS, exact "true" and the Studio shell; default off): every saved theme in the composer's "My themes" list shows the colour chips
// the presets show, not only the saved themes that happen to carry an explicit brand colour.
//
// What the J4 run saw (PASS2-J4-FINDINGS item 6a; S9): "QA J4 S9 test", saved on a preset base (Gilded Noir), was listed first under My themes with no colour chip, while the older
// saved themes had one. The row's chip is the theme's explicit primary colour (components/builder/studio-theme-menu.tsx savedPrimaryColor), and a theme saved from a preset has none:
// its colours are the preset's, which the list never looked up.
//
// With the flag on, a row shows: for a theme saved on a preset, that preset's chips (title ground, brand, accent, text, surface, background: the canvas Theme dialog's own row, from the
// same Theme Builder contract), with the theme's own colour overrides laid over them; for a custom theme, the colours it names (primary, secondary, tertiary, neutral). When Theme
// Builder has not answered, or the preset is not one it knows, a row keeps what it showed before: its explicit primary colour, or nothing. Chips are never invented.
//
// This file imports nothing, so a node test can load it on its own.

// Literal property access so Next inlines the values into the client bundle.
export const STUDIO_THEME_SAVED_CHIPS_ENABLED = process.env.NEXT_PUBLIC_STUDIO_THEME_SAVED_CHIPS === 'true' && process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'

/** The few fields of a saved theme's payload the chips read. */
export interface SavedThemePayload {
  mode?: string
  preset_id?: string
  primary_hex?: string
  secondary_hex?: string
  tertiary_hex?: string
  neutral_hex?: string
  color_overrides?: Record<string, string>
}

/** A preset's palette as the picker reads it from Theme Builder (lib/theme-preset-swatches.ts PresetSwatchPalette). */
export interface PresetChipPalette {
  background: string
  surface: string
  primary: string
  accent: string
  text: string
  swatch?: { canvas: string; hero: string; lead: string }
}

/** At most five distinct six-digit colours, first seen first (case-insensitive), the rest ignored. */
export const SAVED_CHIP_LIMIT = 5

const HEX = /^#[0-9a-fA-F]{6}$/

function distinctColors(colors: readonly unknown[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of colors) {
    if (typeof value !== 'string' || !HEX.test(value)) continue
    const key = value.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(value)
  }
  return out.slice(0, SAVED_CHIP_LIMIT)
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

/** The preset whose palette a saved theme's colours come from: a theme saved in preset mode names it; a custom theme carries its own colours. */
export function savedThemePresetId(payload: unknown): string | null {
  if (!isRecord(payload) || payload.mode !== 'preset') return null
  return typeof payload.preset_id === 'string' && payload.preset_id.trim() !== '' ? payload.preset_id : null
}

/**
 * The chips for a saved theme's row, or [] when there is nothing true to show.
 * `palette` is the base preset's palette when Theme Builder answered for it (null or absent otherwise).
 */
export function savedThemeChips(payload: unknown, palette?: PresetChipPalette | null): string[] {
  if (!isRecord(payload)) return []
  const overrides = isRecord(payload.color_overrides) ? payload.color_overrides : {}
  const explicitPrimary = HEX.test(String(overrides.primary)) ? overrides.primary : payload.mode === 'custom' && HEX.test(String(payload.primary_hex)) ? payload.primary_hex : undefined
  if (payload.mode === 'custom') {
    return distinctColors([explicitPrimary, overrides.secondary ?? payload.secondary_hex, overrides.tertiary ?? payload.tertiary_hex, overrides.neutral ?? payload.neutral_hex])
  }
  if (savedThemePresetId(payload) !== null && isRecord(palette)) {
    const pick = (token: string, fallback: unknown) => (HEX.test(String(overrides[token])) ? overrides[token] : fallback)
    const primary = pick('primary', palette.primary)
    return distinctColors([palette.swatch?.hero ?? primary, primary, pick('accent', palette.accent), pick('text_primary', palette.text), pick('surface', palette.surface), pick('background', palette.background)])
  }
  return distinctColors([explicitPrimary])
}
