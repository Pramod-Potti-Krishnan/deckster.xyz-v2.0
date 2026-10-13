export interface ElementThemeMetadata {
  themeVariantId: string | null
  themeBindings: Record<string, string> | null
}

interface ThemeMetadataCarrier {
  theme_variant_id?: unknown
  themeVariantId?: unknown
  theme_bindings?: unknown
  themeBindings?: unknown
  metadata?: unknown
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function asBindings(value: unknown): Record<string, string> | null {
  const record = asRecord(value)
  if (!record) return null
  return Object.fromEntries(
    Object.entries(record).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  )
}

/**
 * Normalizes both Text Labs response shapes. Top-level fields are canonical;
 * nested metadata remains accepted for rolling deployments. The requested
 * per-box assignment is the final fallback so multi-compose cannot collapse
 * distinct variants when an older backend omits its echo.
 */
export function resolveElementThemeMetadata(
  element: ThemeMetadataCarrier,
  requested?: Partial<ElementThemeMetadata> | null,
): ElementThemeMetadata {
  const nested = asRecord(element.metadata)
  const topVariant = element.theme_variant_id ?? element.themeVariantId
  const nestedVariant = nested?.theme_variant_id ?? nested?.themeVariantId
  const variant = typeof topVariant === 'string'
    ? topVariant
    : typeof nestedVariant === 'string'
      ? nestedVariant
      : requested?.themeVariantId ?? null

  const bindings = asBindings(element.theme_bindings ?? element.themeBindings)
    ?? asBindings(nested?.theme_bindings ?? nested?.themeBindings)
    ?? requested?.themeBindings
    ?? null

  return { themeVariantId: variant, themeBindings: bindings }
}
