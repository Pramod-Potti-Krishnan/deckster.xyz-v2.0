// OUTLINE CARD G4 (FRONTEND-1; DIRECTOR-2's read-only diagnosis G-4 of the outline card): three defects in the expanded slide of components/builder/chat/studio-outline-card.tsx, one flag.
//
//   (a) THE KEY MESSAGE TWICE. The expanded slide draws context.key_message under "Key message" and then slide.narrative as its own paragraph, and the narrative can open with a line "Key message: <the same text>".
//       Fix: when context.key_message is set, that leading narrative line is left out if its text, after the "Key message:" label, is the key message (both sides trimmed, whitespace collapsed, case ignored, the label dropped).
//       Every other line stays, and so does a narrative whose first line is anything else (or a different key message).
//   (b) THE SUBTITLE IS NEVER DRAWN. The slide frame can carry a subtitle (slide.subtitle); the card never shows it. Fix: it is drawn first in the expanded body, as a plain paragraph, when it is a non-empty string.
//   (c) AN EMPTY RESEARCH BLOCK. A slide whose research_status is "conceptual" with no citations (0 or missing), no source types and no issues still drew "Research details" (a status line and, perhaps, a readiness line). Fix: that block is not drawn.
//       Any other status, any citation, any source type or any issue keeps it exactly as it was. The key points are not touched.
//
// One flag, NEXT_PUBLIC_STUDIO_OUTLINE_CARD_G4, the string "true", default off, build-time. Off, the card's render is byte for byte what it was (outlineCardG4View hands back the slide's own narrative, no subtitle and hasResearch).
//
// IMPORT-FREE BY DESIGN: scripts/test-studio-outline-card-g4.mjs transpiles this file into a bare function scope with a fake `process`.

export function outlineCardG4FlagOn(value: string | undefined): boolean {
  return value === 'true'
}

/** The flag (a literal process.env read, so Next inlines it at build time). */
export const STUDIO_OUTLINE_CARD_G4_ENABLED = outlineCardG4FlagOn(process.env.NEXT_PUBLIC_STUDIO_OUTLINE_CARD_G4)

/** The slice of a slide context (hooks/use-deckster-websocket-v2.ts SlideContextItem) these rules read. */
export interface OutlineCardG4Context {
  key_message?: string | null
  research_status?: string | null
  citation_count?: number | null
  source_types?: readonly string[] | null
  research_issues?: readonly string[] | null
}

export interface OutlineCardG4View {
  narrative: string
  subtitle: string | null
  research: boolean
}

const LABEL = 'key message:'
/** Trimmed, whitespace collapsed, lower case: how a line and the key message are compared. */
const normalise = (text: string): string => text.trim().replace(/\s+/g, ' ').toLowerCase()
/** The normalised text without a leading "Key message:" label. */
const withoutLabel = (text: string): string => { const line = normalise(text); return line.startsWith(LABEL) ? line.slice(LABEL.length).trim() : line }

/**
 * (a) The narrative without its leading "Key message:" line when that line repeats `keyMessage`. The leading line is the first one with any text. Out with it go the blank lines before it and the blank
 * lines right after it (the paragraph is drawn pre-wrapped, so they would show); every other line is kept as it was. Anything else gives the narrative back untouched.
 */
export function outlineCardNarrative(narrative: string, keyMessage: string | null | undefined): string {
  if (typeof narrative !== 'string' || typeof keyMessage !== 'string') return narrative
  const wanted = withoutLabel(keyMessage)
  if (wanted === '') return narrative
  const lines = narrative.split('\n')
  const first = lines.findIndex(line => line.trim() !== '')
  if (first === -1) return narrative
  const lead = normalise(lines[first])
  if (!lead.startsWith(LABEL) || lead.slice(LABEL.length).trim() !== wanted) return narrative
  let from = first + 1
  while (from < lines.length && lines[from].trim() === '') from++
  return lines.slice(from).join('\n')
}

/** (b) The subtitle to draw: the trimmed text of a non-empty string, else null. */
export function outlineCardSubtitle(subtitle: unknown): string | null {
  return typeof subtitle === 'string' && subtitle.trim() !== '' ? subtitle.trim() : null
}

/** (c) True when the slide's research is the empty conceptual kind: status "conceptual", no citations (0 or missing), no source types, no issues. */
export function outlineCardResearchEmpty(context: OutlineCardG4Context | null | undefined): boolean {
  if (!context) return false
  return context.research_status === 'conceptual' && !(Number(context.citation_count) > 0) && !context.source_types?.length && !context.research_issues?.length
}

/** What the expanded slide draws: with the flag off, the slide's own narrative, no subtitle and `hasResearch` (the base card's); on, the three fixes. */
export function outlineCardG4View(enabled: boolean, slide: { narrative: string; subtitle?: string | null }, context: OutlineCardG4Context | null | undefined, hasResearch: boolean): OutlineCardG4View {
  if (!enabled) return { narrative: slide.narrative, subtitle: null, research: hasResearch }
  return { narrative: outlineCardNarrative(slide.narrative, context?.key_message), subtitle: outlineCardSubtitle(slide.subtitle), research: hasResearch && !outlineCardResearchEmpty(context) }
}
