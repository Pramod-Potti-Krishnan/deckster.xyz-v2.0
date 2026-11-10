export const STYLE_OWNERS = [
  'text_service',
  'analytics',
  'image_builder',
  'illustrator',
  'diagram_generator',
  'slide_builder_placeholder',
] as const

export const THEME_VARIANT_SOURCES = [
  'element_generation',
  'full_deck_generation',
  'user_edit',
] as const

export type StyleOwner = (typeof STYLE_OWNERS)[number]
export type ThemeVariantSource = (typeof THEME_VARIANT_SOURCES)[number]

const STYLE_OWNER_SET = new Set<string>(STYLE_OWNERS)
const THEME_VARIANT_SOURCE_SET = new Set<string>(THEME_VARIANT_SOURCES)

function normalize(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const candidate = value.trim().toLowerCase().replace(/[\s-]+/g, '_')
  return candidate || null
}

export function parseStyleOwner(value: unknown): StyleOwner | null {
  const candidate = normalize(value)
  return candidate && STYLE_OWNER_SET.has(candidate) ? candidate as StyleOwner : null
}

export function parseThemeVariantSource(value: unknown): ThemeVariantSource | null {
  const candidate = normalize(value)
  return candidate && THEME_VARIANT_SOURCE_SET.has(candidate)
    ? candidate as ThemeVariantSource
    : null
}

export function responseStyleOwner(element: any): StyleOwner | null {
  return parseStyleOwner(
    element?.style_owner
      ?? element?.styleOwner
      ?? element?.metadata?.style_owner
      ?? element?.metadata?.styleOwner,
  )
}
