/**
 * J2-F4 (R-20261007-frontend-9): the thumbnail-rail heading and the canvas footer
 * ("Slide x / y") read two different counters, and a slide CRUD acknowledgement
 * only updated one of them.
 *
 *   rail heading  -> SlideThumbnailStrip `totalSlides` prop  <- viewer `totalSlides`
 *   footer total  -> `visualTotalSlides || totalSlides || ...` (presentation-viewer.tsx)
 *
 * `totalSlides` is the real slide count. `visualTotalSlides` is the real count plus
 * any pending Slide Composer sections, and is normally refreshed only by the 3 s
 * `getCurrentSlideInfo` poll. The Add / Duplicate / Delete acknowledgements commit
 * `totalSlides` straight from the ack (`slide_count`) but leave `visualTotalSlides`
 * at its old value until the next poll, so the footer lags the rail by one.
 *
 * With the flag on, the ack commits both counters from the same number, and the
 * footer never shows a total below the real count. Flag off: callers keep the
 * original expressions, so behaviour is unchanged.
 */
export const STUDIO_SLIDE_COUNT_SYNC_ENABLED =
  process.env.NEXT_PUBLIC_STUDIO_SLIDE_COUNT_SYNC_ENABLED === 'true'

function whole(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0
}

/**
 * The visual total after a CRUD acknowledgement moved the real total from
 * `totalBefore` to `totalAfter`. Pending Composer sections (visual minus real)
 * are preserved; a visual total that had fallen behind the real total (the bug
 * state) never produces a total below `totalAfter`.
 */
export function visualTotalAfterCommit(input: {
  totalBefore: number
  visualBefore: number
  totalAfter: number
}): number {
  const totalAfter = whole(input.totalAfter)
  const pendingSections = Math.max(0, whole(input.visualBefore) - whole(input.totalBefore))
  return totalAfter + pendingSections
}

/**
 * The footer's total with the flag on: the larger of the viewer's visual and
 * real counters (so it can never sit below the rail's count), then the prop and
 * placeholder fallbacks the footer already had.
 */
export function syncedFooterTotal(input: {
  visualTotalSlides: number
  totalSlides: number
  slideCount: number | null | undefined
  partialArtifact: boolean
}): number | string {
  return Math.max(whole(input.visualTotalSlides), whole(input.totalSlides))
    || input.slideCount
    || (input.partialArtifact ? '—' : 1)
}
