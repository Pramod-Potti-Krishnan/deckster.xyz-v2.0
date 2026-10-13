// PASS2-DIRECTOR-CHAT PR D, item 6 (flag NEXT_PUBLIC_STUDIO_CHAT_COMPOSER_CONTEXT): the one line of words above the composer that says
// what a message will be about, as the accepted v4 mockup's composer does ("Working on slide 3").
//
// Pure and import-free: it is handed values the Builder page already holds (whether a deck is open, the slide on the canvas) and returns
// a string. It reads nothing, stores nothing and sends nothing. The flag is checked by the caller.

export interface StudioComposerContext {
  /** A presentation with slides is open (the same test the transcript uses for its "open deck" context). */
  deckOpen: boolean
  /** The slide on the canvas, 1-based. */
  slideNumber: number
  /** How many slides the open deck has, when known. */
  slideCount?: number | null
}

export function studioComposerContextLabel(context: StudioComposerContext): string {
  if (!context.deckOpen) return 'New presentation'
  const { slideNumber, slideCount } = context
  const countKnown = typeof slideCount === 'number' && Number.isFinite(slideCount) && slideCount > 0
  if (Number.isInteger(slideNumber) && slideNumber >= 1 && (!countKnown || slideNumber <= (slideCount as number))) {
    return `Working on slide ${slideNumber}`
  }
  return 'Working on your presentation'
}
