// PASS2D (flag NEXT_PUBLIC_STUDIO_THEME_PREVIEW_CANON, exact "true" and the Studio shell; default off): the Themes & brand preview draws a preset in the colours Theme Builder's own
// canon contract gives it, the colours the deck picker shows and the built deck uses, not the older palette copy kept in components/studio-libraries/theme-preview.tsx.
//
// What the J4 run saw (PASS2-J4-FINDINGS item 5; THEME-2 run 2): a base of "Gilded Noir" previewed as a white slide with lavender circles and saved an indigo swatch, where the deck
// picker shows near-black with gold; Minimal previewed slate (#334155 / #94a3b8) instead of its black and red. theme-preview.tsx keeps six pre-canon palettes, and any other preset
// (the four canon-only ones) fell back to Corporate Light's blue, so people designed a brand on a preview that did not match their deck.
//
// The canon colours are read, not copied: components/studio-libraries/use-canon-preview-palettes.ts asks Theme Builder for each preset's contract exactly as the deck picker does
// (components/theme-panel.tsx useCanonPresetPalettes: lib/theme-preset-swatches.ts loadPresetSwatchPalettes, GET /api/v1/themes/presets/{id}), so no Theme Builder colour lives here.
//
// What this decides, given the preset and what Theme Builder has answered so far:
//  1. Theme Builder answered with a complete palette for it: that palette (background, surface, brand, accent, heading text).
//  2. Otherwise a preset theme-preview.tsx already had a palette for keeps it (what the deck picker does while Theme Builder is silent).
//  3. Otherwise a canon-only preset gets a neutral grey, never another preset's colours.
//  4. Otherwise (Auto, or a base Theme Builder does not know) today's reference palette.
// With the flag off nothing here is called, and the preview is as it was.
//
// This file imports nothing, so a node test can load it on its own.

// Literal property access so Next inlines the values into the client bundle. The try only guards the node test sandboxes that have no `process` (as lib/theme-builder.ts does).
function readPreviewCanonFlag(): boolean {
  try {
    return process.env.NEXT_PUBLIC_STUDIO_THEME_PREVIEW_CANON === 'true' && process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'
  } catch {
    return false
  }
}

export const STUDIO_THEME_PREVIEW_CANON_ENABLED = readPreviewCanonFlag()

/** A preset's palette as the deck picker reads it from Theme Builder (lib/theme-preset-swatches.ts PresetSwatchPalette); only these fields are used. */
export interface CanonPreviewPalette {
  background: string
  surface: string
  primary: string
  accent: string
  text: string
}

export type PreviewBase = Record<string, string>

/** The neutral grey of a canon-only preset Theme Builder has not answered for yet (the deck picker's own pending swatch, components/theme-panel.tsx PENDING_PREVIEW_PALETTE). */
export const PENDING_CANON_PREVIEW_BASE: Readonly<PreviewBase> = {
  background: '#ffffff', surface: '#f3f4f6', primary: '#d1d5db', accent: '#e5e7eb', text_primary: '#374151',
}

const HEX = /^#[0-9a-fA-F]{6}$/

/** The preview's base palette from a Theme Builder palette, or null unless all five colours are six-digit hex. */
export function canonPreviewBase(palette: unknown): PreviewBase | null {
  if (!palette || typeof palette !== 'object') return null
  const p = palette as Record<string, unknown>
  const { background, surface, primary, accent, text } = p
  for (const value of [background, surface, primary, accent, text]) if (typeof value !== 'string' || !HEX.test(value)) return null
  return { background: background as string, surface: surface as string, primary: primary as string, accent: accent as string, text_primary: text as string }
}

/**
 * The base palette for a preview. `canon` is what Theme Builder has answered so far (by preset id); `legacy` is the older palette theme-preview.tsx keeps for the id, if any;
 * `fallback` is today's reference palette. See the file header for the order.
 */
export function previewBaseFor(args: {
  id: string | undefined
  canon: Readonly<Record<string, unknown>>
  legacy: PreviewBase | undefined
  canonOnlyIds: readonly string[]
  fallback: PreviewBase
}): PreviewBase {
  const { id, canon, legacy, canonOnlyIds, fallback } = args
  if (typeof id === 'string' && Object.prototype.hasOwnProperty.call(canon, id)) {
    const answered = canonPreviewBase(canon[id])
    if (answered) return answered
  }
  if (legacy) return legacy
  if (typeof id === 'string' && canonOnlyIds.includes(id)) return { ...PENDING_CANON_PREVIEW_BASE }
  return fallback
}
