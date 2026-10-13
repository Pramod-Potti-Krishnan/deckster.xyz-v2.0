/**
 * PASS2 #10 (frontend-2): deck list cards (Studio "Your decks", /dashboard).
 *
 * Flag NEXT_PUBLIC_STUDIO_DECK_CARDS_V2 (exact "true"; default off). The dashboard reads the flag itself, next to its
 * other NEXT_PUBLIC_STUDIO_* switch, and calls these helpers only when it is on.
 *
 * What the cards showed (accepted-mockup comparison, 12 Oct): the pipeline stage as a second badge ("Stage 4: Preview
 * Ready", "Stage 6: Complete") and the same text twice (the title, then a description that is just the title again).
 * On: one plain status word, and the description only when it adds something. Only fields the sessions API already
 * returns are used; there are no view counts, Q&A counts or publish state in that response, so none are shown.
 */

/** What the dashboard writes into `description` when a session has neither a message nor a title. */
export const DECK_CARD_NO_DESCRIPTION = 'No description available'

export interface DeckCardStatusInput {
  status: 'draft' | 'completed' | 'in-progress'
  finalPresentationUrl?: string | null
  strawmanPreviewUrl?: string | null
}

/**
 * One user-facing status word for the card, derived only from fields the card already has.
 * - a finished deck: "Complete"
 * - an outline that has a preview but no finished deck (the "Strawman Previews" tab): "Outline preview"
 * - anything else that has started: "In progress"
 * - "Draft" for a not-yet-started record
 * The internal stage number and name are never shown.
 */
export function deckCardStatusLabel(input: DeckCardStatusInput): string {
  if (input.status === 'completed') return 'Complete'
  if (input.status === 'draft') return 'Draft'
  if (!input.finalPresentationUrl && input.strawmanPreviewUrl) return 'Outline preview'
  return 'In progress'
}

const TRAILING_FILLER = /[\s.…!?:;,'"“”‘’\-–—]+$/u
const ELLIPSIS = /(…|\.\.\.)\s*$/u

function comparable(text: string): string {
  return text.normalize('NFKC').toLowerCase().replace(/\s+/gu, ' ').trim().replace(TRAILING_FILLER, '')
}

/**
 * The description to show under the title, or null when it would only repeat the title (or is the placeholder).
 * Repeats: the same words (ignoring case, spacing and trailing punctuation), and either side being the other cut short
 * with an ellipsis. A description that says more than the title is kept as is.
 */
export function deckCardDescription(title: string, description: string | null | undefined): string | null {
  const text = typeof description === 'string' ? description.trim() : ''
  if (!text || text === DECK_CARD_NO_DESCRIPTION) return null
  const titleText = typeof title === 'string' ? title.trim() : ''
  const wanted = comparable(text)
  if (!wanted) return null
  const own = comparable(titleText)
  if (!own) return text
  if (wanted === own) return null
  if (ELLIPSIS.test(titleText) && wanted.startsWith(own)) return null
  if (ELLIPSIS.test(text) && own.startsWith(wanted)) return null
  return text
}
