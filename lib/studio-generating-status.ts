/**
 * PASS2B batch 1 (J3-05): while an element generates, the Add Element panel showed a bare spinner on the send button and a disabled box: nothing
 * said what was happening or how long it takes (an image about a minute, a Creative infographic about 80 s), and Escape was ignored while the
 * header's ✕ still closed the panel, so the two ways out disagreed. Flag NEXT_PUBLIC_STUDIO_GENERATING_STATUS, exact 'true', default off; off is
 * today's panel exactly.
 *
 * On:
 * - a status line under the prompt box ("Generating chart… usually 10–30 s"), in an aria-live="polite" region, for as long as the panel's
 *   `isGenerating` is true. A per-type duration is stated only where it is known (Chart 10–30 s; Image and Infographic 60–90 s); the other types
 *   say what is happening and no number.
 * - Escape does what the header's ✕ does: the panel's own `onClose` (the page's `generationPanel.closePanel()`: it hides the panel and clears its
 *   error; it does NOT abort the request, which keeps running). Not generating, Escape is unchanged. While generating, an Escape typed in a text
 *   field OUTSIDE the panel (the chat box) is left alone; inside the panel every field is disabled during a generation, so there is no text an
 *   Escape could discard.
 *
 * Pure: no React, no DOM, no network.
 */

export const STUDIO_GENERATING_STATUS_ENABLED = process.env.NEXT_PUBLIC_STUDIO_GENERATING_STATUS === 'true'

/** The wording per element type: what it is called mid-sentence, and how long it usually takes where that is known. */
const GENERATING_COPY: Record<string, { noun: string; usually?: string }> = {
  TEXT_BOX: { noun: 'text box' },
  METRICS: { noun: 'metrics' },
  TABLE: { noun: 'table' },
  CHART: { noun: 'chart', usually: '10–30 s' },
  IMAGE: { noun: 'image', usually: '60–90 s' },
  ICON_LABEL: { noun: 'icon / label' },
  SHAPE: { noun: 'shape' },
  INFOGRAPHIC: { noun: 'infographic', usually: '60–90 s' },
  DIAGRAM: { noun: 'diagram' },
}

/** "Generating chart… usually 10–30 s". An unknown type reads "Generating element…". */
export function generatingStatusText(elementType: string): string {
  const copy = GENERATING_COPY[elementType] ?? { noun: 'element' }
  return copy.usually ? `Generating ${copy.noun}… usually ${copy.usually}` : `Generating ${copy.noun}…`
}

export interface EscapeWhileGeneratingInput {
  /** Defaults to the flag; a test may pass it. */
  enabled?: boolean
  isGenerating: boolean
  /** The Escape keydown came from an editable control (input, textarea, select, contenteditable) ... */
  fromEditableField: boolean
  /** ... that sits outside the panel. */
  outsidePanel: boolean
}

/**
 * Whether an Escape keydown may close the panel while it is generating (the same close as ✕). False while not generating is not this
 * function's business: the panel's existing rule (Escape closes) applies there, flag on or off.
 */
export function escapeClosesWhileGenerating(input: EscapeWhileGeneratingInput): boolean {
  if (!(input.enabled ?? STUDIO_GENERATING_STATUS_ENABLED)) return false
  if (!input.isGenerating) return false
  return !(input.fromEditableField && input.outsidePanel)
}

/** True for an input, textarea, select or contenteditable element (duck-typed so it needs no DOM globals). */
export function isEditableEventTarget(target: unknown): boolean {
  const element = target as { tagName?: unknown; isContentEditable?: unknown } | null
  if (!element || typeof element.tagName !== 'string') return false
  const tag = element.tagName.toUpperCase()
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || element.isContentEditable === true
}
