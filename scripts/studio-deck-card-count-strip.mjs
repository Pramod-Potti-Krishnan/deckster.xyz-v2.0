// Studio deck card count (flag NEXT_PUBLIC_STUDIO_DECK_CARD_SLIDE_COUNT): the lines this change adds to app/(app)/dashboard/page.tsx, which other pins hold to a base commit
// ("without the added lines the file is <base>'s"). Sibling pins call stripDeckCardCount(text) on the Decks page first and then do what they always did, the way they already
// strip the J2-04 status lines (scripts/studio-add-slide-status-strip.mjs). scripts/test-studio-deck-card-count.mjs proves the strip and that every addition is inert with the flag off.

export const PAGE = 'app/(app)/dashboard/page.tsx'

const PAGE_ADDITIONS = [
  ["import { studioDeckCardCountLabel } from \"@/lib/studio-deck-card-count\"\n", ""],
  ["  // PASS2D R5 (flag NEXT_PUBLIC_STUDIO_DECK_CARD_SLIDE_COUNT, default off): an unfinished deck's count is the outline's, so the card says \"3 slides planned\", not \"3 slides\" over a \"1 / 1\" thumbnail.\n  const slideCountLabel = process.env.NEXT_PUBLIC_STUDIO_DECK_CARD_SLIDE_COUNT === \"true\"\n", ""],
  ["{slideCountLabel ? <span data-studio-deck-count=\"true\">{studioDeckCardCountLabel(presentation.slideCount, presentation.status)}</span> : <span>{presentation.slideCount} slides</span>}", "<span>{presentation.slideCount} slides</span>"],
]

/** The Decks page without PASS2D R5's lines: one import, one flag constant, and the count span put back to "<n> slides". */
export function stripDeckCardCount(text) {
  return PAGE_ADDITIONS.reduce((result, [added, original]) => result.replace(added, original), text)
}

export const DECK_CARD_COUNT_ADDITIONS = PAGE_ADDITIONS
