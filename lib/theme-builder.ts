export type BuildThemeMode = 'auto' | 'preset' | 'custom'

export interface BuildThemeSelection {
  mode: BuildThemeMode
  preset_id?: string
  primary_hex?: string
  secondary_hex?: string
  tertiary_hex?: string
  neutral_hex?: string
  harmony_preference?: 'auto' | 'monochrome' | 'analogous' | 'complementary' | 'triadic'
  palette_mode?: 'light' | 'dark' | 'both'
  color_overrides?: Record<string, string>
}

export interface ThemePresetSummary {
  preset_id: string
  name: string
  description: string
}

export const CANONICAL_THEME_PRESET_IDS = [
  'corporate_light',
  'corporate_dark',
  'minimal',
  'vibrant',
  'executive',
  'pastel',
] as const

export type CanonicalThemePresetId = typeof CANONICAL_THEME_PRESET_IDS[number]

export const FALLBACK_THEME_PRESETS: ThemePresetSummary[] = [
  {
    preset_id: 'corporate_light',
    name: 'Corporate Light',
    description: 'Clean business theme with a blue brand base',
  },
  {
    preset_id: 'corporate_dark',
    name: 'Corporate Dark',
    description: 'Dark executive theme with high-contrast accents',
  },
  {
    preset_id: 'minimal',
    name: 'Minimal',
    description: 'Quiet, restrained theme for simple narratives',
  },
  {
    preset_id: 'vibrant',
    name: 'Vibrant',
    description: 'High-energy theme with stronger accent colors',
  },
  {
    preset_id: 'executive',
    name: 'Executive',
    description: 'Boardroom theme with polished, formal styling',
  },
  {
    preset_id: 'pastel',
    name: 'Pastel',
    description: 'Softer theme for lighter educational or creative decks',
  },
]

export const THEME_PRESET_ALIASES: Record<string, string> = {
  'corporate-blue': 'corporate_light',
  corporate_blue: 'corporate_light',
  'dark-mode': 'corporate_dark',
  dark_mode: 'corporate_dark',
  'elegant-emerald': 'minimal',
  elegant_emerald: 'minimal',
  'vibrant-orange': 'vibrant',
  vibrant_orange: 'vibrant',
  professional: 'corporate_light',
  children: 'vibrant',
  kids: 'vibrant',
  education: 'pastel',
  educational: 'pastel',
}

export function normalizeThemePresetId(id: string | null | undefined): string | undefined {
  const trimmed = id?.trim()
  if (!trimmed) return undefined
  const normalized = trimmed.toLowerCase().replace(/\s+/g, '_')
  return THEME_PRESET_ALIASES[normalized] || normalized
}

export function isCanonicalThemePresetId(
  id: string | null | undefined,
): id is CanonicalThemePresetId {
  return CANONICAL_THEME_PRESET_IDS.includes(id as CanonicalThemePresetId)
}

/**
 * Normalize saved/legacy theme selections at the UI boundary without dropping
 * explicit literal overrides. Director remains the only persistence owner.
 */
export function normalizeThemePanelSelection(
  selection: BuildThemeSelection,
): BuildThemeSelection {
  const colorOverrides = selection.color_overrides
    ? { ...selection.color_overrides }
    : undefined

  if (selection.mode !== 'preset') {
    return {
      ...selection,
      color_overrides: colorOverrides,
    }
  }

  const normalizedPreset = normalizeThemePresetId(selection.preset_id)
  return {
    ...selection,
    preset_id: isCanonicalThemePresetId(normalizedPreset)
      ? normalizedPreset
      : 'corporate_light',
    color_overrides: colorOverrides,
  }
}

export function themeSelectionFingerprint(selection: BuildThemeSelection): string {
  const normalized = normalizeThemePanelSelection(selection)
  const overrides = normalized.color_overrides
    ? Object.fromEntries(
      Object.entries(normalized.color_overrides).sort(([a], [b]) => a.localeCompare(b)),
    )
    : undefined
  return JSON.stringify({ ...normalized, color_overrides: overrides })
}

/**
 * Switch the named base theme while retaining explicit literals. Custom-theme
 * brand colors are promoted into token overrides so changing the base does not
 * silently discard the user's choices.
 */
export function selectCanonicalThemePreset(
  selection: BuildThemeSelection,
  presetId: string,
): BuildThemeSelection {
  const normalizedPreset = normalizeThemePresetId(presetId)
  const canonicalPreset: CanonicalThemePresetId = isCanonicalThemePresetId(normalizedPreset)
    ? normalizedPreset
    : 'corporate_light'
  const colorOverrides: Record<string, string> = {
    ...(selection.color_overrides || {}),
  }

  const customTokens: Array<[string, string | undefined]> = [
    ['primary', selection.primary_hex],
    ['secondary', selection.secondary_hex],
    ['tertiary', selection.tertiary_hex],
    ['neutral', selection.neutral_hex],
  ]
  customTokens.forEach(([token, literal]) => {
    if (literal && colorOverrides[token] === undefined) {
      colorOverrides[token] = literal
    }
  })

  return {
    mode: 'preset',
    preset_id: canonicalPreset,
    harmony_preference: selection.harmony_preference,
    palette_mode: selection.palette_mode,
    color_overrides: Object.keys(colorOverrides).length > 0 ? colorOverrides : undefined,
  }
}

export function isValidThemeHex(value: string | null | undefined): value is string {
  return /^#[0-9a-fA-F]{6}$/.test(value || '')
}
