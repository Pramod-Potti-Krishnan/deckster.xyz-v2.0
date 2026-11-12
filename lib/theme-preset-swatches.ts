/**
 * T-06 (theme audit TM3), behind NEXT_PUBLIC_THEME_PICKER_CANON_ENABLED.
 *
 * Picker swatches read Theme Builder's own preset contract, the same registry
 * TB resolves when it builds the deck: GET /api/v1/themes/presets/{id} returns
 * the active (canon, on UAT) ThemeContract. No static copy of TB colours lives
 * in the frontend, so the swatch cannot drift from the build.
 *
 * The card swatch shows what the built deck visibly shows (`swatch`):
 * - canvas: the content canvas, always light for content slides (Slide
 *   Builder `_derive_theme_mode`, PK ruling 31 Aug; measured #ffffff on all
 *   ten presets in the Q57 renders);
 * - hero: the ground of the title, section and closing slides
 *   (`palette.hero.hero_background`, the built `--hero-bg`);
 * - lead: the deck's lead colour (`palette.brand.primary`, the built
 *   `--theme-primary`).
 * The other fields keep their Theme Builder token meaning, because the panel's
 * palette guide, custom-colour seeds and override placeholders read them.
 */

export interface PresetSwatchPalette {
  background: string
  surface: string
  primary: string
  accent: string
  text: string
  swatch: { canvas: string; hero: string; lead: string }
}

export const CONTENT_CANVAS_HEX = '#ffffff'

const HEX = /^#[0-9a-fA-F]{6}$/

function pick(source: unknown, path: string[]): string | null {
  let node: unknown = source
  for (const key of path) {
    if (!node || typeof node !== 'object') return null
    node = (node as Record<string, unknown>)[key]
  }
  return typeof node === 'string' && HEX.test(node) ? node.toLowerCase() : null
}

/** Map a TB ThemeContract (GET /presets/{id}) to the picker swatch, or null when incomplete. */
export function swatchPaletteFromThemeContract(contract: unknown): PresetSwatchPalette | null {
  const hero = pick(contract, ['palette', 'hero', 'hero_background'])
  const primary = pick(contract, ['palette', 'brand', 'primary'])
  const accent = pick(contract, ['palette', 'accent', 'accent'])
  const background = pick(contract, ['palette', 'neutral', 'background'])
  const surface = pick(contract, ['palette', 'neutral', 'surface'])
  const text = pick(contract, ['palette', 'text', 'text_primary'])
  if (!hero || !primary || !accent || !background || !surface || !text) return null
  return {
    background,
    surface,
    primary,
    accent,
    text,
    swatch: { canvas: CONTENT_CANVAS_HEX, hero, lead: primary },
  }
}

type FetchLike = (input: string) => Promise<{ ok: boolean; json: () => Promise<unknown> }>

const cache = new Map<string, Promise<PresetSwatchPalette | null>>()

/** One read-only GET per preset per page load; a failure is not cached, so the next mount retries. */
export function fetchPresetSwatchPalette(
  baseUrl: string,
  presetId: string,
  fetchImpl: FetchLike = (input) => fetch(input),
): Promise<PresetSwatchPalette | null> {
  const base = baseUrl.replace(/\/+$/, '')
  const key = `${base}|${presetId}`
  const cached = cache.get(key)
  if (cached) return cached
  const request = fetchImpl(`${base}/api/v1/themes/presets/${encodeURIComponent(presetId)}`)
    .then(async (response) => (response.ok ? swatchPaletteFromThemeContract(await response.json()) : null))
    .catch(() => null)
    .then((palette) => {
      if (!palette) cache.delete(key)
      return palette
    })
  cache.set(key, request)
  return request
}

export async function loadPresetSwatchPalettes(
  baseUrl: string,
  presetIds: readonly string[],
  fetchImpl?: FetchLike,
): Promise<Record<string, PresetSwatchPalette>> {
  const entries = await Promise.all(
    presetIds.map(async (id) => [id, await fetchPresetSwatchPalette(baseUrl, id, fetchImpl)] as const),
  )
  const loaded: Record<string, PresetSwatchPalette> = {}
  for (const [id, palette] of entries) if (palette) loaded[id] = palette
  return loaded
}
