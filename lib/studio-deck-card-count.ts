// PASS2D R5 (flag NEXT_PUBLIC_STUDIO_DECK_CARD_SLIDE_COUNT, default off). Standalone and import-free: pure string work, no React, no clock, no network.
//
// A deck card on the Decks page draws "<n> slides" from the session row's slideCount and, above it, a live thumbnail of the deck's Layout presentation whose own counter
// ("1 / 1") counts the slides that really exist in that presentation. For a finished deck (stage 6) the two are the same deck's count. For a deck that is still in progress
// (stage 4 and 5: the outline is waiting for approval, or the build has not finished) the row's count is the OUTLINE's slide count, written from Director's outline frames,
// while the thumbnail is whatever Layout holds so far: one blank slide, or the partly built deck. Pilot Results read "3 slides" over a "1 / 1" thumbnail.
//
// Pilot Results was also a row the build before #389 had polluted: its final slots held the blank one-slide deck, and the card previews the final deck first, so it drew that blank deck
// (the "1 / 1") next to the outline's count. The card now previews the deck its count describes: an unfinished deck that has a strawman previews the strawman (the outline as Layout holds it),
// a finished deck its final deck.
//
// The count is not wrong, it is the plan. So the card says which it is: a finished deck keeps "<n> slides" (singular "1 slide", where the old text said "1 slides"); a deck that
// is not finished says "<n> slides planned" ("1 slide planned"), and one with no count yet says "No slides yet". Only fields the card already has are used.

/** The slide count as a non-negative whole number; anything else (missing, NaN, negative, fractional, a string) is 0. */
export function studioDeckCardSlideCount(slideCount: unknown): number {
  return Number.isSafeInteger(slideCount) && (slideCount as number) > 0 ? (slideCount as number) : 0
}

/** The count line of a deck card. `status` is the card's own ("completed" is a finished deck; "in-progress", "draft" or anything else is not). */
export function studioDeckCardCountLabel(slideCount: unknown, status: unknown): string {
  const count = studioDeckCardSlideCount(slideCount)
  const noun = count === 1 ? 'slide' : 'slides'
  if (status === 'completed') return `${count} ${noun}`
  return count > 0 ? `${count} ${noun} planned` : 'No slides yet'
}

/** What a deck card's thumbnail previews. Unfinished (anything but "completed") with a strawman: the strawman; otherwise the final deck, then the strawman, as before. */
export function studioDeckCardPreviewUrl(card: { status?: unknown; finalPresentationUrl?: string | null; strawmanPreviewUrl?: string | null } | null | undefined): string | null {
  if (!card || typeof card !== 'object') return null
  const finalUrl = typeof card.finalPresentationUrl === 'string' && card.finalPresentationUrl !== '' ? card.finalPresentationUrl : null
  const strawmanUrl = typeof card.strawmanPreviewUrl === 'string' && card.strawmanPreviewUrl !== '' ? card.strawmanPreviewUrl : null
  if (card.status !== 'completed' && strawmanUrl) return strawmanUrl
  return finalUrl || strawmanUrl
}
