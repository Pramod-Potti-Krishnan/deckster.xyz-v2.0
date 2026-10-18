// PASS2D R5 (flag NEXT_PUBLIC_STUDIO_DECK_CARD_SLIDE_COUNT, default off). Standalone and import-free: pure string work, no React, no clock, no network.
//
// A deck card on the Decks page draws "<n> slides" from the session row's slideCount and, above it, a live thumbnail of the deck's Layout presentation whose own counter
// ("1 / 1") counts the slides that really exist in that presentation. For a finished deck (stage 6) the two are the same deck's count. For a deck that is still in progress
// (stage 4 and 5: the outline is waiting for approval, or the build has not finished) the row's count is the OUTLINE's slide count, written from Director's outline frames,
// while the thumbnail is whatever Layout holds so far: one blank slide, or the partly built deck. Pilot Results read "3 slides" over a "1 / 1" thumbnail.
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
