/**
 * Studio slide rail v2 (PASS2 item 1): readable labels and real slide thumbnails, as in the accepted Studio v4 mockup rail.
 *
 * Behind NEXT_PUBLIC_STUDIO_SLIDE_RAIL_V2 (exact 'true', default off). Off = the rail is exactly as before.
 *
 * - Labels: each card carries a one-line "01 Title" row above its preview. The title gets the row's full width (the refine
 *   button no longer takes a fixed slot in it, it appears over the row's end on hover or focus), ends in an ellipsis, and its
 *   full text is the row's tooltip. Today the refine and options buttons left the title about 28 px ("Slid 3").
 * - Width: the rail opens at the mockup's 140 px instead of 120 px (a width the user dragged to is still remembered).
 * - Thumbnails: a card with no thumbnail URL already gets a live view-only render of its slide (F9-A, flag
 *   NEXT_PUBLIC_STUDIO_RAIL_LIVE_PREVIEW_FALLBACK_ENABLED), but at most 3 at a time across the rail, so a deck with no
 *   Stage F images (Layout inventory status `none` on every slide) showed "No preview" from the 4th card down. With this
 *   flag the cap is SLIDE_RAIL_V2_MAX_FRAMES, enough for every card on screen; frames still mount only while their card is
 *   on screen. A ready frame hides the "No preview" placeholder underneath it.
 *
 * Pure: no React, no DOM, no network.
 */

export const STUDIO_SLIDE_RAIL_V2 = process.env.NEXT_PUBLIC_STUDIO_SLIDE_RAIL_V2 === 'true'

/** The rail's opening width in CSS pixels (the mockup's rail at 1440 px). Today's is 120. */
export const SLIDE_RAIL_V2_DEFAULT_WIDTH = 140

/** Live frames across the whole rail: every card a 900 px to 1300 px tall rail shows at once. Today's is 3. */
export const SLIDE_RAIL_V2_MAX_FRAMES = 12

/** The card's number as the mockup writes it: two digits at least ("01", "12", "120"). */
export function slideRailV2Number(visualNumber: number): string {
  return String(visualNumber).padStart(2, '0')
}
