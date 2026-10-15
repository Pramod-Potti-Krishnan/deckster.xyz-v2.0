/**
 * PASS2B G20 (flag NEXT_PUBLIC_STUDIO_RAIL_LAYOUT_LABELS, exact 'true', default off): an untitled slide in the Studio slide rail reads as its
 * layout's friendly name ("Image + text", "Chart", "Section divider") instead of "Slide 7", as the accepted v4 mockup's rail does.
 *
 * The data is what the rail already holds: the `layout` Layout's slide inventory sends per slide (lib/slide-rail-identity.ts) and the layout
 * catalogue the layout picker and the rail's own "Change layout" menu already use (SLIDE_LAYOUTS in types/elements.ts). No request, no storage.
 * Pure: it reads a value and returns a string. Off, nothing calls it and the rail reads exactly as before.
 *
 * Layout names a slide's layout three ways, all understood here: the catalogue id ("C1-text"), the series code the inventory sends
 * ("C1", "H1s", "V2") and the retired L-codes ("L29"). Anything else (a code with no catalogue entry, an empty value, a non-string)
 * returns null, so the rail keeps "Slide N" and never prints a raw identifier.
 */
import { SLIDE_LAYOUTS } from '@/types/elements'

export const STUDIO_RAIL_LAYOUT_LABELS = process.env.NEXT_PUBLIC_STUDIO_RAIL_LAYOUT_LABELS === 'true'

/** The retired L-codes, as components/slide-layout-picker.tsx maps them (LEGACY_LAYOUT_MAP): code -> catalogue id. */
const LEGACY_CODES: Record<string, string> = {
  L01: 'H1-structured',
  L02: 'H2-section',
  L03: 'C1-text',
  L25: 'V1-image-text',
  L27: 'I1-image-left',
  L29: 'H1-generated',
}

/** "Title (AI)" and "Title (Manual)" are two ways to make one kind of slide: the rail names the kind. */
function friendly(label: string): string {
  return label.replace(/\s*\([^)]*\)\s*$/, '').trim()
}

const NAME_BY_ID = new Map<string, string>()
const NAME_BY_SERIES = new Map<string, string>()
for (const { layout, label } of SLIDE_LAYOUTS) {
  const name = friendly(label)
  NAME_BY_ID.set(layout.toLowerCase(), name)
  const series = layout.split('-')[0].toLowerCase()
  if (!NAME_BY_SERIES.has(series)) NAME_BY_SERIES.set(series, name)
}

/** A slide's layout value as the rail row carries it -> its friendly name, or null when it has none. */
export function railLayoutName(layout: unknown): string | null {
  if (typeof layout !== 'string') return null
  const key = layout.trim().toLowerCase()
  if (!key) return null
  const legacy = LEGACY_CODES[key.toUpperCase()]
  if (legacy) return NAME_BY_ID.get(legacy.toLowerCase()) ?? null
  const byId = NAME_BY_ID.get(key)
  if (byId) return byId
  // The inventory's series codes: "C1", "V2", and "H1s" (the structured title).
  const series = /^([a-z]\d)s?$/.exec(key)
  return series ? NAME_BY_SERIES.get(series[1]) ?? null : null
}
