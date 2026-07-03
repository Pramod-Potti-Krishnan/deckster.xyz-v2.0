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

export function isValidThemeHex(value: string | null | undefined): value is string {
  return /^#[0-9a-fA-F]{6}$/.test(value || '')
}
