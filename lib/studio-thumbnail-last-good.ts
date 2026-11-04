/**
 * NEXT_PUBLIC_STUDIO_THUMBNAIL_LAST_GOOD (exact "true", default off, build-time): the Studio half of the THUMBNAILS-BLANK-UAT "never blank" contract.
 * Layout (LAYOUT_THUMBNAIL_LAST_GOOD_ENABLED) adds two keys to each slide-inventory row: `last_good_thumbnail_url` (the slide's last registered preview, fresh
 * or stale) and `thumbnail_stale_reason` ("content" or "theme"). With this flag on, a rail card with no fresh preview shows ITS OWN slide's last good one
 * (lib/slide-rail-identity.ts, which reads the same flag and stays import-free), marked with the cue below; the Publish preview widens #495's fresh-only rule to the same
 * image for slide 0 (lib/studio-publish-preview-inventory.ts, only when #495's flag is on too). Off, nothing here is used and no row, card or preview changes.
 * This module is pure: the words of the cue and the choice between its two accessible labels.
 */

/** Why the image is not fresh: the slide changed since the capture, or the deck's theme did. */
export type ThumbnailLagReason = 'content' | 'theme'

/** The visible cue on the card's preview (both reasons), small and plain. */
export const THUMBNAIL_LAG_TEXT = 'May lag'

/** The accessible label of the cue, by reason. */
export const THUMBNAIL_LAG_LABELS: Readonly<Record<ThumbnailLagReason, string>> = {
  content: 'Preview may not show recent edits',
  theme: 'Preview shows the previous theme',
}

/** "theme" is the theme reason; null, absent and any other value read as the content reason. */
export function thumbnailLagReason(value: unknown): ThumbnailLagReason {
  return value === 'theme' ? 'theme' : 'content'
}

/** The accessible label for a reason (the content label for null or an unknown one). */
export function thumbnailLagLabel(value: unknown): string {
  return THUMBNAIL_LAG_LABELS[thumbnailLagReason(value)]
}
