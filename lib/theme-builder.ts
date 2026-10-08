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

/**
 * T-07/T-06 (theme audit TM4 + TM3): NEXT_PUBLIC_THEME_PICKER_CANON_ENABLED,
 * default OFF. On, the picker offers all ten Theme Builder canon presets and
 * the four canon-only ids reach Director unchanged instead of being coerced to
 * corporate_light. Off, the six ids, the six fallback entries and the
 * coercion are exactly today's. The try only guards non-Next contexts (the
 * node test sandboxes) that have no `process`; Next inlines the value.
 */
function readThemePickerCanonFlag(): boolean {
  try {
    return process.env.NEXT_PUBLIC_THEME_PICKER_CANON_ENABLED === 'true'
  } catch {
    return false
  }
}

export const THEME_PICKER_CANON_ENABLED = readThemePickerCanonFlag()

const PICKER_THEME_PRESET_IDS = [
  'corporate_light',
  'corporate_dark',
  'minimal',
  'vibrant',
  'executive',
  'pastel',
] as const

/** Registered by Theme Builder's canon library, not offered while the flag is off. */
export const CANON_ONLY_THEME_PRESET_IDS = [
  'concrete_acid',
  'espresso_editorial',
  'gilded_noir',
  'mission_amber',
] as const

export type CanonicalThemePresetId =
  | typeof PICKER_THEME_PRESET_IDS[number]
  | typeof CANON_ONLY_THEME_PRESET_IDS[number]

export const CANONICAL_THEME_PRESET_IDS: readonly CanonicalThemePresetId[] = THEME_PICKER_CANON_ENABLED
  ? [...PICKER_THEME_PRESET_IDS, ...CANON_ONLY_THEME_PRESET_IDS]
  : PICKER_THEME_PRESET_IDS

const PICKER_FALLBACK_THEME_PRESETS: ThemePresetSummary[] = [
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

// Names and descriptions are Theme Builder's own canon metadata
// (config/canon_presets.py `ContractMeta`, served by GET /api/v1/themes/presets).
const CANON_ONLY_FALLBACK_THEME_PRESETS: ThemePresetSummary[] = [
  {
    preset_id: 'concrete_acid',
    name: 'Concrete Acid',
    description: 'Flat concrete slabs, sharp corners — acid #D6F221 reserved for the takeaway',
  },
  {
    preset_id: 'espresso_editorial',
    name: 'Espresso Editorial',
    description: 'Hairline ivory editorial — caramel punctuation, columns by rules not boxes',
  },
  {
    preset_id: 'gilded_noir',
    name: 'Gilded Noir',
    description: 'Border-not-fill near-black — 1px gold hairlines, gold as line and type',
  },
  {
    preset_id: 'mission_amber',
    name: 'Mission Amber',
    description: 'Dual-ground dark card-token — orange on dark, red form on paper slides',
  },
]

export const FALLBACK_THEME_PRESETS: ThemePresetSummary[] = THEME_PICKER_CANON_ENABLED
  ? [...PICKER_FALLBACK_THEME_PRESETS, ...CANON_ONLY_FALLBACK_THEME_PRESETS]
  : PICKER_FALLBACK_THEME_PRESETS

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
