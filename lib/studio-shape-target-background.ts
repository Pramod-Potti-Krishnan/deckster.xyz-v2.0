// J3-SHAPE-FILL-CONTRAST-FE (ELEMENT-2): NEXT_PUBLIC_STUDIO_SHAPE_TARGET_BACKGROUND (exact "true"), default off.
//
// With Fill on "Auto (deck)" Studio sends no fill, and Text Labs paints the deck primary on an assumed light ground (#F1F4F9). On a dark
// slide (a navy hero) that is navy on navy (1.40:1). Text Labs (!96, TL_SHAPE_FILL_CONTRAST_ENABLED) picks the first palette colour with
// >= 3:1 against `shape_config.target_background` when that is a hex. This is the Studio half: with the flag on, and Fill Auto, and
// Background not set by the user, send the current slide's ground as `target_background: "#rrggbb"`.
//
// Where the ground comes from (nothing new is asked of Layout; both reads already exist):
//   1. viewer postMessage `getTemplateSlotCatalog` -> `canvas_type` of the slide ("H1s", "H2", "H3", "H1", "C1", "L25", ...), the id Layout
//      stamps on the slide (src/utils/semantic-slot-catalog.js:143-179, viewer/presentation-viewer.html:3943-3955). The panel already hands
//      the forms this reader (`getTemplateSlotCatalog`).
//   2. REST GET /api/presentations/{id}/theme/css-variables -> `css_variables` of the deck (layout-builder server.py:2980-3180), which
//      `useDeckThemePalette` already fetches: `--theme-bg` is the content-slide ground, `--theme-hero-bg` the hero (H*) ground.
// A hero layout (H1, H1s, H2, H3) takes `--theme-hero-bg`; every other layout takes `--theme-bg`. Only a solid colour is sent: rgb()/
// rgba() with alpha 1, #rgb, #rrggbb and a few plain names are turned into #rrggbb; a gradient, url(), var(), hsl(), a translucent colour
// or anything unknown is NOT guessed and nothing is sent (Text Labs then does what it did before).
// Known limit: Layout has no command that reports a slide's painted ground, so a slide with its own stored background_color, or a hero
// painted over a photo, is measured by its layout's theme ground, not by the pixels.

export const STUDIO_SHAPE_TARGET_BACKGROUND_ENABLED = process.env.NEXT_PUBLIC_STUDIO_SHAPE_TARGET_BACKGROUND === 'true'

const NAMED: Record<string, string> = {
  white: '#ffffff', black: '#000000', red: '#ff0000', lime: '#00ff00', blue: '#0000ff', yellow: '#ffff00', cyan: '#00ffff', aqua: '#00ffff',
  magenta: '#ff00ff', fuchsia: '#ff00ff', gray: '#808080', grey: '#808080', silver: '#c0c0c0', maroon: '#800000', olive: '#808000',
  green: '#008000', purple: '#800080', teal: '#008080', navy: '#000080', orange: '#ffa500',
}

const hex2 = (n: number) => n.toString(16).padStart(2, '0')

/** A solid colour as lower-case #rrggbb, or null (gradient, image, var(), hsl(), translucent, unknown, not a string). */
export function normaliseGroundToHex(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const text = value.trim().toLowerCase()
  if (!text || text.length > 64) return null
  let m = /^#([0-9a-f]{6})$/.exec(text)
  if (m) return `#${m[1]}`
  m = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(text)
  if (m) return `#${m[1]}${m[1]}${m[2]}${m[2]}${m[3]}${m[3]}`
  m = /^#([0-9a-f]{6})ff$/.exec(text)
  if (m) return `#${m[1]}`
  m = /^rgba?\(\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*(?:[,/]\s*(\d*\.?\d+)(%?)\s*)?\)$/.exec(text)
  if (m) {
    const channels = [Number(m[1]), Number(m[2]), Number(m[3])]
    if (channels.some(c => c > 255)) return null
    if (m[4] !== undefined && (m[5] ? Number(m[4]) !== 100 : Number(m[4]) !== 1)) return null
    return `#${channels.map(hex2).join('')}`
  }
  return NAMED[text] ?? null
}

/** Hero layouts (H1, H1s, H2, H3; Layout's `canvas_type` is already alias-normalised) are painted on the deck's hero ground. */
export function isHeroCanvasType(canvasType: unknown): boolean {
  return typeof canvasType === 'string' && /^H\d/i.test(canvasType.trim())
}

/** The deck-theme colour a slide of this layout sits on, as #rrggbb; null when the layout or the theme colour is not known. */
export function resolveSlideGroundHex(canvasType: unknown, cssVars: Record<string, unknown> | null | undefined): string | null {
  if (typeof canvasType !== 'string' || !canvasType.trim() || !cssVars) return null
  const names = isHeroCanvasType(canvasType) ? ['--theme-hero-bg'] : ['--theme-bg', '--theme-background']
  for (const name of names) {
    const hex = normaliseGroundToHex(cssVars[name])
    if (hex) return hex
    if (cssVars[name] !== undefined && cssVars[name] !== null && cssVars[name] !== '') return null // present but not solid: do not fall through to another token
  }
  return null
}

/** `shape_config.target_background` is the "light"/"dark" the user picked; only a hex is a ground Studio worked out and sent itself. */
export function isSentGroundValue(value: unknown): boolean {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value.trim())
}

export interface ShapeGroundField {
  enabled: boolean
  fillExplicit: boolean
  backgroundExplicit: boolean
  groundHex: string | null
}

/** The extra shape_config key, or {} (flag off, Fill or Background set by the user, or no solid ground known). */
export function shapeTargetBackgroundField(input: ShapeGroundField): { target_background?: string } {
  if (!input.enabled || input.fillExplicit || input.backgroundExplicit || !input.groundHex) return {}
  return { target_background: input.groundHex }
}
