/**
 * Shared constants for the snap-deck pattern. Used by SnapDeck (which mounts
 * the snap CSS and binds keyboard nav) and SlideNavArrows (the on-screen
 * up/down chevron buttons).
 *
 * This is the default 48px header height. Pages with different chrome pass
 * `headerOffsetPx` to SnapDeck, which sets the matching scroll padding.
 */

export const HEADER_OFFSET_PX = 48
export const SCROLL_TOLERANCE_PX = 32
