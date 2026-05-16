/**
 * Shared constants for the snap-deck pattern. Used by SnapDeck (which mounts
 * the snap CSS and binds keyboard nav) and SlideNavArrows (the on-screen
 * up/down chevron buttons).
 *
 * If you change the sticky header height, update HEADER_OFFSET_PX here AND
 * the matching `scroll-padding-top` in app/globals.css under html.snap-deck.
 */

export const HEADER_OFFSET_PX = 48
export const SCROLL_TOLERANCE_PX = 32
